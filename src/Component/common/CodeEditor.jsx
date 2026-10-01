import { memo, useEffect, useRef, useState } from 'react';

/**
 * CodeMirror 6 wrapper, loaded lazily so the editor chunk (~120KB)
 * is only fetched on the Open/Edit screens — never on list screens.
 * Falls back to a plain <pre> while the chunk loads.
 */
const CodeEditor = memo(function CodeEditor({ value, onChange, readOnly = false, label = 'Solution' }) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const [ready, setReady] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value ?? '');
  valueRef.current = value ?? '';

  useEffect(() => {
    let cancelled = false;
    let view = null;

    (async () => {
      const [{ EditorView, lineNumbers, highlightActiveLineGutter }, { EditorState }, { java }, { oneDark }] =
        await Promise.all([
          import('@codemirror/view'),
          import('@codemirror/state'),
          import('@codemirror/lang-java'),
          import('@codemirror/theme-one-dark'),
        ]);
      if (cancelled || !hostRef.current) return;

      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current?.(update.state.doc.toString());
        }
      });

      const state = EditorState.create({
        doc: valueRef.current,
        extensions: [
          lineNumbers(),
          java(),
          oneDark,
          EditorView.lineWrapping,
          EditorView.editable.of(!readOnly),
          EditorState.readOnly.of(readOnly),
          highlightActiveLineGutter(),
          updateListener,
          EditorView.theme({
            '&': { backgroundColor: 'var(--surface-2)', color: 'var(--text)' },
            '.cm-content': { fontFamily: 'var(--font-mono)', fontSize: '13px', lineHeight: '1.65' },
            '.cm-gutters': {
              backgroundColor: 'rgba(9,12,19,0.55)',
              color: 'var(--text-faint)',
              borderRight: '1px solid var(--border)',
            },
            '&.cm-focused': { outline: 'none' },
          }),
        ],
      });

      view = new EditorView({ state, parent: hostRef.current });
      viewRef.current = view;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      view?.destroy();
      viewRef.current = null;
    };
    // Re-create only when readOnly flips; value syncs via the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  // Push external value changes (e.g. loaded problem) into the editor
  // without resetting the cursor when the change originated locally.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const next = value ?? '';
    if (view.state.doc.toString() !== next) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: next },
      });
    }
  }, [value, ready]);

  return (
    <div className="cm-host">
      <div ref={hostRef} role="textbox" aria-label={label} aria-readonly={readOnly} aria-multiline="true" />
      {!ready && (
        <pre className="cm-fallback" aria-hidden="true">
          {value || ''}
        </pre>
      )}
    </div>
  );
});

export default CodeEditor;
