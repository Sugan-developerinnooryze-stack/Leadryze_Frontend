import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef } from 'react';

interface Props {
  value: string;
  onChange: (html: string) => void;
}

function ToolBtn({
  onClick, active, children, title,
}: { onClick: () => void; active: boolean; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      className={`px-1.5 py-0.5 rounded text-xs font-medium border leading-none ${
        active
          ? 'bg-brand-600 text-white border-brand-600'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

export default function RichEditor({ value, onChange }: Props) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '',
    onUpdate: ({ editor: ed }) => {
      onChangeRef.current(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[3.5rem] px-2 py-1.5 text-xs text-gray-600 leading-relaxed',
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="border border-gray-200 rounded overflow-hidden bg-gray-50">
      {/* Toolbar — hidden when printing */}
      <div className="print:hidden flex flex-wrap gap-1 p-1.5 border-b border-gray-200 bg-white">
        <ToolBtn title="Bold"          onClick={() => editor.chain().focus().toggleBold().run()}                     active={editor.isActive('bold')}><strong>B</strong></ToolBtn>
        <ToolBtn title="Italic"        onClick={() => editor.chain().focus().toggleItalic().run()}                   active={editor.isActive('italic')}><em>I</em></ToolBtn>
        <ToolBtn title="Heading"       onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}      active={editor.isActive('heading', { level: 2 })}>H1</ToolBtn>
        <ToolBtn title="Sub-heading"   onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}      active={editor.isActive('heading', { level: 3 })}>H2</ToolBtn>
        <ToolBtn title="Ordered list"  onClick={() => editor.chain().focus().toggleOrderedList().run()}              active={editor.isActive('orderedList')}>1.</ToolBtn>
        <ToolBtn title="Bullet list"   onClick={() => editor.chain().focus().toggleBulletList().run()}               active={editor.isActive('bulletList')}>•</ToolBtn>
        <div className="w-px bg-gray-200 mx-0.5" />
        <ToolBtn title="Clear marks"   onClick={() => editor.chain().focus().unsetAllMarks().run()}                  active={false}>T</ToolBtn>
      </div>
      <EditorContent editor={editor} />
      <style>{`
        .ProseMirror ul { list-style-type: disc; padding-left: 1.25rem; }
        .ProseMirror ol { list-style-type: decimal; padding-left: 1.25rem; }
        .ProseMirror li { margin: 0.125rem 0; }
        .ProseMirror h2 { font-size: 0.8rem; font-weight: 700; margin: 0.25rem 0; }
        .ProseMirror h3 { font-size: 0.75rem; font-weight: 600; margin: 0.125rem 0; }
        .ProseMirror p  { margin: 0.125rem 0; }
        .ProseMirror p:first-child { margin-top: 0; }
      `}</style>
    </div>
  );
}
