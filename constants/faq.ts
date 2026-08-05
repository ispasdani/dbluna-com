export const faqs = [
  {
    question: "What is DBLuna and what does it do?",
    answer:
      "DBLuna is a visual database schema design and documentation tool. Design tables, columns, and relationships on an infinite canvas, keep everything in sync with a DBML code editor, and get a searchable documentation site generated automatically. No separate write-up needed.",
  },
  {
    question: "How do I create my first database schema?",
    answer:
      "Add a table from the toolbar, then click into it to add columns, set types, and mark primary keys. Drag between columns to create foreign-key relationships. Prefer code? Switch to the Code tab and write DBML directly, and the canvas updates as you type. You can also start from a template in the Templates tab.",
  },
  {
    question: "What export and import formats are supported?",
    answer:
      "You can export a full-fidelity DBML or JSON file and import it back exactly as it was. For pulling in an existing schema, DBLuna also supports live imports from PostgreSQL and SQL Server connections, plus CSV and BACPAC files.",
  },
  {
    question: "Can I import an existing database?",
    answer:
      "Yes. Connect directly to a live PostgreSQL or SQL Server database, or upload a CSV or BACPAC file, and DBLuna will parse the schema and lay it out on the canvas automatically.",
  },
  {
    question: "Can I share a schema with my team?",
    answer:
      "You can generate a read-only share link for any diagram. No account needed on either end, and nothing is sent to a server since the link encodes the diagram itself. Real-time multi-user editing with live cursors and roles isn't available yet; it's on our roadmap.",
  },
  {
    question: "What's the difference between visual and code modes?",
    answer:
      "Visual mode is the drag-and-drop canvas for tables, relationships, notes, and areas. Code mode is a DBML editor (with JSON and Mermaid views). Both stay in sync, so editing either one updates the other instantly.",
  },
  {
    question: "What can I do on the Free plan?",
    answer:
      "Free accounts are view-only: you can open and browse any diagram shared with you, including its generated documentation. To create, edit, export, or share your own diagrams, you'll need a Pro plan.",
  },
  {
    question: "Where is my data stored? Is it safe?",
    answer:
      "By default, every diagram is stored locally in your browser. Nothing leaves your device. If you want to reach a diagram from another device, you can opt in to cloud sync per diagram; it's never required.",
  },
];
