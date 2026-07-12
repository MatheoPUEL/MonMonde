import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table'
import Placeholder from '@tiptap/extension-placeholder'

interface Props {
  content: string
  onChange?: (json: string, text: string) => void
  placeholder?: string
  readOnly?: boolean
}

interface ToolbarBtnProps {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}

function ToolbarBtn({ onClick, active, title, children }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      className={`editor-toolbar-btn${active ? ' editor-toolbar-btn--active' : ''}`}
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
    >
      {children}
    </button>
  )
}

export function RichEditor({ content, onChange, placeholder, readOnly = false }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: placeholder ?? 'Commence à écrire…' }),
    ],
    content: (() => { try { return content ? JSON.parse(content) : '' } catch { return '' } })(),
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange?.(JSON.stringify(editor.getJSON()), editor.getText())
    },
  })

  if (!editor) return null

  function insertImage() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        editor.chain().focus().setImage({ src: reader.result as string }).run()
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  function insertLink() {
    const url = window.prompt('URL du lien :')
    if (url) editor.chain().focus().setLink({ href: url }).run()
  }

  return (
    <div className={`rich-editor${readOnly ? ' rich-editor--readonly' : ''}`}>
      {!readOnly && (
        <div className="editor-toolbar">
          <div className="editor-toolbar-group">
            <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Gras"><strong>B</strong></ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italique"><em>I</em></ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Souligné"><u>U</u></ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Barré"><s>S</s></ToolbarBtn>
          </div>
          <div className="editor-toolbar-sep" />
          <div className="editor-toolbar-group">
            <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Titre 1">H1</ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Titre 2">H2</ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Titre 3">H3</ToolbarBtn>
          </div>
          <div className="editor-toolbar-sep" />
          <div className="editor-toolbar-group">
            <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Liste à puces">•—</ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Liste numérotée">1.</ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Citation">❝</ToolbarBtn>
          </div>
          <div className="editor-toolbar-sep" />
          <div className="editor-toolbar-group">
            <ToolbarBtn onClick={insertLink} active={editor.isActive('link')} title="Lien">🔗</ToolbarBtn>
            <ToolbarBtn onClick={insertImage} active={false} title="Image">🖼</ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} active={false} title="Séparateur">—</ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} active={false} title="Tableau">⊞</ToolbarBtn>
          </div>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}
