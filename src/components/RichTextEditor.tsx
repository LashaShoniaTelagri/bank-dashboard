import { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Heading1,
  Quote,
  Undo,
  Redo,
  Table as TableIcon,
  Minus,
  Trash2,
  Strikethrough,
  ImageIcon,
  LinkIcon,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const RichTextEditor = ({ value, onChange, placeholder }: RichTextEditorProps) => {
  const isUpdatingFromProps = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Handle image upload to Supabase Storage
  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    try {
      setIsUploadingImage(true);
      
      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `editor-images/${fileName}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('orchard-maps') // Reusing existing bucket
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('orchard-maps')
        .getPublicUrl(filePath);

      toast({
        title: "Image uploaded",
        description: "Image has been successfully uploaded",
      });

      return publicUrl;
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload image",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsUploadingImage(false);
    }
  }, []);

  // Handle image paste
  const handleImagePaste = useCallback(async (file: File, editor: any) => {
    const url = await uploadImage(file);
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [uploadImage]);
  
  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({
        inline: true,
        allowBase64: false,
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg border border-border my-4',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline hover:text-primary/80 cursor-pointer',
        },
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      // Don't call onChange if we're updating from props
      if (!isUpdatingFromProps.current) {
        onChange(editor.getHTML());
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-4 py-3',
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) {
              handleImagePaste(file, editor);
            }
            return true;
          }
        }
        return false;
      },
    },
  }, [handleImagePaste]);

  // Sync editor content when value prop changes (but not on every keystroke)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      isUpdatingFromProps.current = true;
      editor.commands.setContent(value);
      // Reset flag after a short delay to allow the update to complete
      setTimeout(() => {
        isUpdatingFromProps.current = false;
      }, 0);
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  const MenuButton = ({
    onClick,
    active,
    disabled,
    children,
    title,
    label,
  }: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    title: string;
    label?: string;
  }) => (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        label ? "h-8 px-2" : "h-8 w-8 p-0",
        active && "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
      )}
      title={title}
    >
      {children}
      {label && <span className="ml-1 text-xs font-medium">{label}</span>}
    </Button>
  );

  return (
    <div className="border-0 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="bg-muted/50 border-b border-border p-2 flex items-center gap-1 flex-wrap">
        <MenuButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </MenuButton>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </MenuButton>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <MenuButton
          onClick={() => {
            const url = window.prompt('Enter link URL:');
            if (url) {
              editor.chain().focus().setLink({ href: url }).run();
            }
          }}
          active={editor.isActive('link')}
          title="Add Link (Ctrl+K)"
        >
          <LinkIcon className="h-4 w-4" />
        </MenuButton>

        {editor.isActive('link') && (
          <MenuButton
            onClick={() => editor.chain().focus().unsetLink().run()}
            title="Remove Link"
            label="Unlink"
          >
            <span className="sr-only">Remove Link</span>
          </MenuButton>
        )}

        <MenuButton
          onClick={() => fileInputRef.current?.click()}
          title="Insert Image"
          disabled={isUploadingImage}
        >
          {isUploadingImage ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImageIcon className="h-4 w-4" />
          )}
        </MenuButton>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <MenuButton
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          title="Insert Table"
        >
          <TableIcon className="h-4 w-4" />
        </MenuButton>

        {editor.isActive('table') && (
          <>
            <MenuButton
              onClick={() => editor.chain().focus().addColumnBefore().run()}
              title="Add Column Before"
              label="+ Col"
            >
              <span className="sr-only">Add Column</span>
            </MenuButton>

            <MenuButton
              onClick={() => editor.chain().focus().deleteColumn().run()}
              title="Delete Column"
              label="- Col"
            >
              <span className="sr-only">Delete Column</span>
            </MenuButton>

            <MenuButton
              onClick={() => editor.chain().focus().addRowBefore().run()}
              title="Add Row Before"
              label="+ Row"
            >
              <span className="sr-only">Add Row</span>
            </MenuButton>

            <MenuButton
              onClick={() => editor.chain().focus().deleteRow().run()}
              title="Delete Row"
              label="- Row"
            >
              <span className="sr-only">Delete Row</span>
            </MenuButton>

            <MenuButton
              onClick={() => editor.chain().focus().deleteTable().run()}
              title="Delete Table"
              disabled={!editor.can().deleteTable()}
            >
              <Trash2 className="h-4 w-4 text-red-600" />
            </MenuButton>
          </>
        )}

        <Separator orientation="vertical" className="h-6 mx-1" />

        <MenuButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Line"
        >
          <Minus className="h-4 w-4" />
        </MenuButton>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <MenuButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (Ctrl+Z)"
        >
          <Undo className="h-4 w-4" />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (Ctrl+Y)"
        >
          <Redo className="h-4 w-4" />
        </MenuButton>
      </div>

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file && editor) {
            const url = await uploadImage(file);
            if (url) {
              editor.chain().focus().setImage({ src: url }).run();
            }
          }
          // Reset input
          e.target.value = '';
        }}
      />

      {/* Editor Content */}
      <div className="relative">
        <EditorContent 
          editor={editor} 
          className="bg-background min-h-[300px] max-h-[600px] overflow-y-auto p-4"
        />
        
        {!value && placeholder && (
          <div className="absolute top-4 left-4 text-muted-foreground text-sm pointer-events-none">
            {placeholder}
          </div>
        )}
      </div>

      {/* Custom Editor Styles */}
      <style jsx global>{`
        .ProseMirror {
          outline: none;
        }
        
        .ProseMirror h1 {
          font-size: 2em;
          font-weight: bold;
          margin-top: 0.67em;
          margin-bottom: 0.67em;
          line-height: 1.2;
          color: hsl(var(--foreground));
        }
        
        .ProseMirror h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin-top: 0.83em;
          margin-bottom: 0.83em;
          line-height: 1.3;
          color: hsl(var(--foreground));
        }
        
        .ProseMirror h3 {
          font-size: 1.17em;
          font-weight: bold;
          margin-top: 1em;
          margin-bottom: 1em;
          color: hsl(var(--foreground));
        }
        
        .ProseMirror p {
          margin-top: 0.5em;
          margin-bottom: 0.5em;
          color: hsl(var(--foreground));
        }
        
        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 1.5em;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }
        
        .ProseMirror ul {
          list-style-type: disc;
        }
        
        .ProseMirror ol {
          list-style-type: decimal;
        }
        
        .ProseMirror li {
          margin-top: 0.25em;
          margin-bottom: 0.25em;
          color: hsl(var(--foreground));
        }
        
        .ProseMirror strong {
          font-weight: bold;
        }
        
        .ProseMirror em {
          font-style: italic;
        }
        
        .ProseMirror s {
          text-decoration: line-through;
        }
        
        .ProseMirror hr {
          border: none;
          border-top: 2px solid hsl(var(--border));
          margin: 1.5em 0;
        }
        
        .ProseMirror table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 1em 0;
          overflow: hidden;
        }
        
        .ProseMirror table td,
        .ProseMirror table th {
          min-width: 1em;
          border: 2px solid hsl(var(--border));
          padding: 0.5em 0.75em;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
          background-color: hsl(var(--background));
          color: hsl(var(--foreground));
        }
        
        .ProseMirror table th {
          font-weight: bold;
          text-align: left;
          background-color: hsl(var(--muted));
        }
        
        .ProseMirror table .selectedCell {
          background-color: hsl(var(--accent));
        }
        
        .ProseMirror table .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: 0;
          width: 4px;
          background-color: hsl(var(--primary));
          cursor: col-resize;
        }
        
        .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          border: 1px solid hsl(var(--border));
          margin: 1rem 0;
          display: block;
        }
        
        .ProseMirror img.ProseMirror-selectednode {
          outline: 2px solid hsl(var(--primary));
          outline-offset: 2px;
        }
        
        .ProseMirror a {
          color: hsl(var(--primary));
          text-decoration: underline;
          cursor: pointer;
        }
        
        .ProseMirror a:hover {
          color: hsl(var(--primary) / 0.8);
        }
        
        .ProseMirror blockquote {
          border-left: 3px solid hsl(var(--border));
          margin: 1em 0;
          padding-left: 1em;
          color: hsl(var(--muted-foreground));
        }
      `}</style>
    </div>
  );
};

