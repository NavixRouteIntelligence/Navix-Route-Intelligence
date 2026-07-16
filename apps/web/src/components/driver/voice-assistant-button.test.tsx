import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LocaleProvider } from '@/lib/i18n/locale-provider';
import { VoiceAssistantButton, voiceReplyKey } from './voice-assistant-button';

describe('voiceReplyKey', () => {
  it('mapeia a intenção para a chave de resposta', () => {
    expect(voiceReplyKey('next_stop')).toBe('voice.reply.next_stop');
    expect(voiceReplyKey('unknown')).toBe('voice.reply.unknown');
  });
});

describe('VoiceAssistantButton', () => {
  it('degrada com elegância quando o navegador não suporta voz (jsdom)', () => {
    render(
      <LocaleProvider>
        <VoiceAssistantButton />
      </LocaleProvider>,
    );
    expect(screen.getByText(/não suporta comando de voz/i)).toBeInTheDocument();
  });
});
