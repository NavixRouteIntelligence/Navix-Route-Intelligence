'use client';

import type { VoiceCommandView, VoiceIntent } from '@navix/contracts';
import { Mic, MicOff } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import { intelligenceApi } from '@/lib/api/intelligence';
import type { TranslationKey } from '@/lib/i18n/dictionary';
import { useLocale } from '@/lib/i18n/locale-provider';
import { cn } from '@/lib/utils';

/** Mapeia a intenção reconhecida para a chave de resposta falada (i18n no web). */
export function voiceReplyKey(intent: VoiceIntent): TranslationKey {
  return `voice.reply.${intent}` as TranslationKey;
}

// --- Tipagem mínima da Web Speech API (fora do lib DOM padrão) ----------------
interface SpeechRecognitionResultLike {
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function speak(text: string, lang: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  window.speechSynthesis.speak(utterance);
}

export interface VoiceAssistantButtonProps {
  /** Chamado com a intenção reconhecida — o host executa a ação real. */
  onIntent?: (view: VoiceCommandView) => void;
  className?: string;
}

/**
 * Assistente por voz (ADR-0032). Reconhece a fala (STT do navegador), classifica
 * a intenção no backend e responde por voz (TTS). Degrada com elegância quando o
 * navegador não suporta a Web Speech API. O host reage via `onIntent`.
 */
export function VoiceAssistantButton({ onIntent, className }: VoiceAssistantButtonProps) {
  const { locale, t } = useLocale();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const supported = getRecognitionCtor() !== null;

  const handleTranscript = useCallback(
    async (spoken: string) => {
      setTranscript(spoken);
      try {
        const { data } = await intelligenceApi.voiceCommand(spoken, locale);
        const spokenReply = t(voiceReplyKey(data.intent));
        setReply(spokenReply);
        speak(spokenReply, locale);
        onIntent?.(data);
      } catch {
        const fallback = t('voice.reply.unknown');
        setReply(fallback);
      }
    },
    [locale, t, onIntent],
  );

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || listening) return;
    const recognition = new Ctor();
    recognition.lang = locale;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const spoken = event.results[0]?.[0]?.transcript ?? '';
      if (spoken) void handleTranscript(spoken);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [locale, listening, handleTranscript]);

  if (!supported) {
    return (
      <p className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
        <MicOff className="h-4 w-4" aria-hidden="true" />
        {t('voice.unsupported')}
      </p>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <button
        type="button"
        onClick={start}
        disabled={listening}
        aria-label={t('voice.title')}
        aria-pressed={listening}
        className={cn(
          'inline-flex items-center gap-2 self-start rounded-full px-4 py-2 text-sm font-medium transition-colors',
          listening
            ? 'bg-danger/15 text-danger'
            : 'bg-primary text-primary-foreground hover:bg-primary/90',
        )}
      >
        <Mic className={cn('h-4 w-4', listening && 'animate-pulse')} aria-hidden="true" />
        {listening ? t('voice.listening') : t('voice.listen')}
      </button>

      {transcript && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          <span className="font-medium text-foreground">{t('voice.you')}: </span>
          {transcript}
        </p>
      )}
      {reply && (
        <p className="text-sm text-foreground" aria-live="polite">
          {reply}
        </p>
      )}
    </div>
  );
}
