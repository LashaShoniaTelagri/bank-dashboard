# Tiptap Rich Text Editor Installation

The new comparison and monitored issue editing features require Tiptap editor dependencies.

## Required Packages

Run the following command to install the required packages:

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header
```

Or with yarn:

```bash
yarn add @tiptap/react @tiptap/starter-kit @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header
```

## Package Details

- `@tiptap/react` - React bindings for Tiptap
- `@tiptap/starter-kit` - Essential extensions (bold, italic, headings, lists, etc.)
- `@tiptap/extension-table` - Table support
- `@tiptap/extension-table-row` - Table row extension
- `@tiptap/extension-table-cell` - Table cell extension
- `@tiptap/extension-table-header` - Table header extension

## CSS Styling

The editor uses Tailwind's typography plugin for proper prose styling. This should already be configured in your project.

## After Installation

1. Run the migrations to add description fields to monitored_issues table:
   ```bash
   supabase db push --linked
   ```

2. Restart the development server:
   ```bash
   npm run dev
   ```

That's it! The rich text editor should now work perfectly for editing monitored issue descriptions.

