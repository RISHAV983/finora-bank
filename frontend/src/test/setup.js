import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

// jsdom does not implement scrollIntoView, which the chat window calls on new messages.
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
