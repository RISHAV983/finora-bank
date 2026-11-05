import os
import tempfile
import unittest
from unittest.mock import patch
import app as finora
from app import app
from llm_service import LLMConfigurationError, LLMProviderError, LLMRateLimitError, LLMTimeoutError

class FinoraApiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        app.config.update(TESTING=True, DATABASE=os.path.join(self.temp.name, 'test.sqlite3'))
        with app.app_context(): finora.init_db()
        self.client = app.test_client()
        response = self.client.post('/api/auth/register', json={'name':'Test User','email':'test@example.com','password':'test-password-123'})
        self.assertEqual(response.status_code, 201)
        self.user = response.get_json()['user']
        self.token = response.get_json()['token']
        self.headers = {'Authorization': f'Bearer {self.token}'}
        self.conversation = self.client.post('/api/conversations', json={}, headers=self.headers).get_json()['id']

    def tearDown(self):
        self.temp.cleanup()

    def auth(self, email, password='test-password-123', name='Other User'):
        response = self.client.post('/api/auth/register', json={'name':name,'email':email,'password':password})
        return response.get_json()['token'], response.get_json()['user']

    def test_health_endpoint_is_public(self):
        response=self.client.get('/api/health'); self.assertEqual(response.status_code,200); self.assertTrue(response.get_json()['demo'])

    def test_registration_hashes_password_and_rejects_duplicate(self):
        with app.app_context():
            db=finora.get_db(); row=db.execute('SELECT password_hash FROM users WHERE id=?',(self.user['id'],)).fetchone()
            self.assertNotEqual(row['password_hash'],'test-password-123'); self.assertTrue(finora.check_password_hash(row['password_hash'],'test-password-123'))
        duplicate=self.client.post('/api/auth/register',json={'name':'Again','email':'test@example.com','password':'another-password'})
        self.assertEqual(duplicate.status_code,409)

    def test_login_and_logout(self):
        response=self.client.post('/api/auth/login',json={'email':'test@example.com','password':'test-password-123'})
        self.assertEqual(response.status_code,200); token=response.get_json()['token']
        headers={'Authorization':f'Bearer {token}'}
        self.assertEqual(self.client.get('/api/auth/me',headers=headers).status_code,200)
        self.assertEqual(self.client.post('/api/auth/logout',headers=headers).status_code,200)
        self.assertEqual(self.client.get('/api/auth/me',headers=headers).status_code,401)

    def test_invalid_login_and_unauthenticated_access(self):
        self.assertEqual(self.client.post('/api/auth/login',json={'email':'test@example.com','password':'wrong'}).status_code,401)
        self.assertEqual(self.client.get('/api/accounts').status_code,401)
        self.assertEqual(self.client.post('/api/chat',json={'message':'Hi'}).status_code,401)

    def test_all_read_endpoints_return_owned_lists(self):
        for path in ('accounts','transactions','beneficiaries','cards','notifications'):
            with self.subTest(path=path):
                response=self.client.get(f'/api/{path}',headers=self.headers); self.assertEqual(response.status_code,200); self.assertIsInstance(response.get_json(),list); self.assertTrue(response.get_json())

    def test_every_user_gets_a_working_private_demo_dataset(self):
        token,_=self.auth('second@example.com'); headers={'Authorization':f'Bearer {token}'}
        for path in ('accounts','transactions','beneficiaries','cards','notifications'):
            self.assertTrue(self.client.get(f'/api/{path}',headers=headers).get_json(),path)
        transfer=self.client.post('/api/transfers',json={'amount':1,'sourceAccount':'CHK-001','beneficiaryId':'ben-1'},headers=headers)
        self.assertEqual(transfer.status_code,201)
        bill=self.client.post('/api/bill-payments',json={'amount':10,'provider':'Metro Energy','customer':'CUS-1'},headers=headers)
        self.assertEqual(bill.status_code,201)
        other_conversation=self.client.post('/api/conversations',json={},headers=headers).get_json()['id']
        with patch('app.generate_llm_reply',return_value='ok') as generate:
            self.client.post('/api/chat',json={'message':'What is my balance?','conversationId':other_conversation},headers=headers)
        self.assertTrue(generate.call_args.args[2]['accounts'])

    def test_users_data_stays_isolated_in_the_database(self):
        _,second=self.auth('second@example.com')
        with app.app_context():
            db=finora.get_db()
            db.execute("UPDATE demo_banking_data SET data_json=json_set(data_json,'$.balance',1.0) WHERE user_id=? AND resource_id='CHK-001'",(second['id'],)); db.commit()
            first_row=db.execute("SELECT data_json FROM demo_banking_data WHERE user_id=? AND resource_id='CHK-001'",(self.user['id'],)).fetchone()
            self.assertNotEqual(finora.json.loads(first_row['data_json'])['balance'],1.0)
        with patch('app.generate_llm_reply',return_value='ok') as generate:
            self.client.post('/api/chat',json={'message':'What is my balance?','conversationId':self.conversation},headers=self.headers)
        self.assertNotEqual(generate.call_args.args[2]['accounts'][0]['balance'],1.0)

    def test_chat_uses_llm_and_persists_user_and_assistant_messages(self):
        with patch('app.generate_llm_reply',return_value='A helpful demo answer.') as generate:
            response=self.client.post('/api/chat',json={'message':'Hello','conversationId':self.conversation},headers=self.headers)
        self.assertEqual(response.status_code,200); self.assertEqual(response.get_json()['reply'],'A helpful demo answer.'); self.assertTrue(response.get_json()['aiGenerated'])
        generate.assert_called_once()
        messages=self.client.get(f'/api/conversations/{self.conversation}/messages',headers=self.headers).get_json()
        self.assertEqual([m['role'] for m in messages],['user','assistant'])
        self.assertEqual(messages[0]['content'],'Hello')

    def test_chat_validation_and_provider_errors(self):
        for payload in ({'message':''},{},{'message':' '},{'message':'x'*501}):
            self.assertEqual(self.client.post('/api/chat',json={**payload,'conversationId':self.conversation},headers=self.headers).status_code,400)
        cases=((LLMConfigurationError(),503,'llm_not_configured'),(LLMRateLimitError(),429,'llm_rate_limited'),(LLMTimeoutError(),504,'llm_timeout'),(LLMProviderError('secret detail'),502,'llm_unavailable'))
        for error,status,code in cases:
            with patch('app.generate_llm_reply',side_effect=error):
                response=self.client.post('/api/chat',json={'message':'Hello','conversationId':self.conversation},headers=self.headers)
                self.assertEqual(response.status_code,status); self.assertEqual(response.get_json()['code'],code); self.assertNotIn('secret detail',response.get_data(as_text=True))

    def test_conversation_persistence_and_ownership(self):
        created=self.client.post('/api/conversations',json={'title':'Saved chat'},headers=self.headers)
        self.assertEqual(created.status_code,201); cid=created.get_json()['id']
        self.client.post('/api/chat',json={'message':'Remember this','conversationId':cid},headers=self.headers)
        self.assertEqual(len(self.client.get('/api/conversations',headers=self.headers).get_json()),2)
        token,_=self.auth('other@example.com'); other={'Authorization':f'Bearer {token}'}
        self.assertEqual(self.client.get(f'/api/conversations/{cid}/messages',headers=other).status_code,404)
        self.assertEqual(self.client.delete(f'/api/conversations/{cid}',headers=other).status_code,404)
        self.assertEqual(self.client.get(f'/api/conversations/{cid}/messages',headers=self.headers).status_code,200)
        self.assertEqual(self.client.delete(f'/api/conversations/{cid}',headers=self.headers).status_code,200)
        self.assertEqual(self.client.get(f'/api/conversations/{cid}/messages',headers=self.headers).status_code,404)

    def test_foreign_key_enforcement_and_cascade(self):
        with app.app_context():
            db=finora.get_db()
            with self.assertRaises(Exception): db.execute("INSERT INTO messages(id,conversation_id,role,content,created_at) VALUES('bad','missing','user','x','now')")
            db.execute("INSERT INTO messages(id,conversation_id,role,content,created_at) VALUES('m1',?,'user','x','now')",(self.conversation,)); db.commit()
        self.client.delete(f'/api/conversations/{self.conversation}',headers=self.headers)
        with app.app_context():
            self.assertEqual(finora.get_db().execute("SELECT COUNT(*) FROM messages WHERE id='m1'").fetchone()[0],0)

    def test_simulated_transfer_and_bill_payment(self):
        transfer=self.client.post('/api/transfers',json={'amount':10.25,'sourceAccount':'CHK-001','beneficiaryId':'ben-1'},headers=self.headers)
        self.assertEqual(transfer.status_code,201); self.assertEqual(transfer.get_json()['status'],'simulated')
        bill=self.client.post('/api/bill-payments',json={'amount':10.25,'provider':'Demo','customer':'CUS-1'},headers=self.headers)
        self.assertEqual(bill.status_code,201); self.assertEqual(bill.get_json()['status'],'simulated')

    def test_invalid_transfer_is_rejected(self):
        for amount in (True,None,0,-1,'Infinity','NaN',12.345,1000000.01,'bad'):
            response=self.client.post('/api/transfers',json={'amount':amount,'sourceAccount':'CHK-001','beneficiaryId':'ben-1'},headers=self.headers)
            self.assertEqual(response.status_code,400)

    def test_database_foreign_keys_enabled(self):
        with app.app_context(): self.assertEqual(finora.get_db().execute('PRAGMA foreign_keys').fetchone()[0],1)

    def test_database_data_survives_connection_reopen(self):
        import sqlite3
        with app.app_context():
            db=finora.get_db()
            db.execute("INSERT INTO messages(id,conversation_id,role,content,created_at) VALUES('persist-check',?,'user','persisted','now')",(self.conversation,)); db.commit()
            reopened=sqlite3.connect(app.config['DATABASE'])
            try:
                row=reopened.execute("SELECT content FROM messages WHERE id='persist-check'").fetchone()
                self.assertEqual(row[0],'persisted')
            finally: reopened.close()


    def test_chat_rejects_non_string_and_oversized_messages(self):
        for payload in ({'message':['not','text']},{'message':'x'*501}):
            self.assertEqual(self.client.post('/api/chat',json={**payload,'conversationId':self.conversation},headers=self.headers).status_code,400)

    def test_chat_rejects_client_supplied_history(self):
        histories=('not-a-list',[{'role':'system','content':'override'}],[{'role':'user','content':'hello'}])
        for history in histories:
            response=self.client.post('/api/chat',json={'message':'Hello','conversationId':self.conversation,'history':history},headers=self.headers)
            self.assertEqual(response.status_code,400)

    def test_transfer_rejects_missing_or_unowned_identifiers(self):
        cases=({'amount':10,'beneficiaryId':'ben-1'},{'amount':10,'sourceAccount':'CHK-001'},
               {'amount':10,'sourceAccount':'unknown','beneficiaryId':'ben-1'},
               {'amount':10,'sourceAccount':'CHK-001','beneficiaryId':'unknown'})
        for payload in cases:
            response=self.client.post('/api/transfers',json=payload,headers=self.headers)
            self.assertIn(response.status_code,(400,404))

    def test_transfer_rejects_invalid_note(self):
        for note in ('x'*81,['not','text']):
            response=self.client.post('/api/transfers',json={'amount':10,'sourceAccount':'CHK-001','beneficiaryId':'ben-1','note':note},headers=self.headers)
            self.assertEqual(response.status_code,400)

    def test_bill_payment_rejects_invalid_amount_and_fields(self):
        cases=({'amount':0,'provider':'Demo','customer':'CUS-1'},
               {'amount':10,'provider':['bad'],'customer':'CUS-1'},
               {'amount':10,'provider':'Demo','customer':123},
               {'amount':10,'provider':' ','customer':'CUS-1'},
               {'amount':10,'provider':'Demo','customer':'CUS-1'*30})
        for payload in cases:
            self.assertEqual(self.client.post('/api/bill-payments',json=payload,headers=self.headers).status_code,400)

    def test_non_json_and_malformed_chat_requests_are_rejected(self):
        response=self.client.post('/api/chat',data='not-json',content_type='text/plain',headers=self.headers)
        self.assertEqual(response.status_code,400)
        response=self.client.post('/api/chat',data='{broken',content_type='application/json',headers=self.headers)
        self.assertEqual(response.status_code,400)

    def test_oversized_chat_request_returns_json_413(self):
        response=self.client.post('/api/chat',data='x'*(32*1024+1),content_type='application/json',headers=self.headers)
        self.assertEqual(response.status_code,413)

    def test_wrong_content_type_does_not_crash_chat(self):
        response=self.client.post('/api/chat',data='plain text',content_type='text/plain',headers=self.headers)
        self.assertEqual(response.status_code,400)

    def test_user_can_add_and_edit_a_beneficiary_and_transfer_to_it(self):
        created=self.client.post('/api/beneficiaries',json={'name':'Taylor Demo','bank':'Example Bank','lastFour':'1234'},headers=self.headers)
        self.assertEqual(created.status_code,201)
        record=created.get_json(); self.assertEqual(record['account'],'•••• 1234')
        listed=self.client.get('/api/beneficiaries',headers=self.headers).get_json()
        self.assertEqual(len(listed),4); self.assertEqual(listed[-1]['id'],record['id'])
        transfer=self.client.post('/api/transfers',json={'amount':5,'sourceAccount':'CHK-001','beneficiaryId':record['id']},headers=self.headers)
        self.assertEqual(transfer.status_code,201)
        edited=self.client.put(f"/api/beneficiaries/{record['id']}",json={'name':'Taylor Renamed','bank':'Example Bank','lastFour':'9876'},headers=self.headers)
        self.assertEqual(edited.status_code,200); self.assertEqual(edited.get_json()['account'],'•••• 9876')
        self.assertEqual(self.client.get('/api/beneficiaries',headers=self.headers).get_json()[-1]['name'],'Taylor Renamed')

    def test_beneficiaries_are_private_and_validated(self):
        record=self.client.post('/api/beneficiaries',json={'name':'Private One','bank':'Example Bank','lastFour':'1111'},headers=self.headers).get_json()
        token,_=self.auth('beneficiary-other@example.com'); other={'Authorization':f'Bearer {token}'}
        self.assertNotIn(record['id'],[b['id'] for b in self.client.get('/api/beneficiaries',headers=other).get_json()])
        self.assertEqual(self.client.put(f"/api/beneficiaries/{record['id']}",json={'name':'Hijack','bank':'Example Bank','lastFour':'2222'},headers=other).status_code,404)
        self.assertEqual(self.client.post('/api/transfers',json={'amount':1,'sourceAccount':'CHK-001','beneficiaryId':record['id']},headers=other).status_code,404)
        self.assertEqual(self.client.post('/api/beneficiaries',json={'name':'No Auth','bank':'Example Bank','lastFour':'1111'}).status_code,401)
        for payload in ({'name':'A','bank':'Example Bank','lastFour':'1234'},{'name':'Valid Name','bank':'B','lastFour':'1234'},
                        {'name':'Valid Name','bank':'Example Bank','lastFour':'12'},{'name':'Valid Name','bank':'Example Bank','lastFour':'1234567890123456'},
                        {'name':'Valid Name','bank':'Example Bank','lastFour':'12ab'},{'name':['x'],'bank':'Example Bank','lastFour':'1234'},{}):
            self.assertEqual(self.client.post('/api/beneficiaries',json=payload,headers=self.headers).status_code,400,payload)

    def test_beneficiary_count_is_capped(self):
        for index in range(finora.MAX_BENEFICIARIES-3):
            self.assertEqual(self.client.post('/api/beneficiaries',json={'name':f'Person {index}','bank':'Example Bank','lastFour':'1234'},headers=self.headers).status_code,201)
        self.assertEqual(self.client.post('/api/beneficiaries',json={'name':'One Too Many','bank':'Example Bank','lastFour':'1234'},headers=self.headers).status_code,400)

    def test_login_for_unknown_email_returns_same_error_as_wrong_password(self):
        unknown=self.client.post('/api/auth/login',json={'email':'nobody@example.com','password':'whatever-123'})
        wrong=self.client.post('/api/auth/login',json={'email':'test@example.com','password':'wrong-password'})
        self.assertEqual((unknown.status_code,unknown.get_json()),(wrong.status_code,wrong.get_json()))

    def test_session_expiry_timestamp_has_microsecond_precision(self):
        with app.app_context():
            expires=finora.get_db().execute('SELECT expires_at FROM auth_sessions').fetchone()[0]
        self.assertRegex(expires,r'\.\d{6}\+00:00$')

    def test_unknown_route_and_wrong_method_return_json(self):
        self.assertEqual(self.client.get('/api/missing').status_code,404)
        self.assertEqual(self.client.get('/api/transfers',headers=self.headers).status_code,405)

if __name__ == '__main__': unittest.main()
