---
alwaysApply: true
---

## Platform Choices

The following rules establish choices for the runtime, framework, or any
additional build steps.

- Each concept should be backed by MongoDB, configured by environment variables.
  Choose a default collection name, and share a single database (configured in
  the environment) to share across all concepts. No concept should know about
  another's collection or schema.
- Utilize the Deno runtime for simplified tooling and imports. Prefer to use
  generic imports without version numbers to reliably import libraries. This
  means to use "npm:..." and "jsr:..." style imports without numbers if
  possible.
- To the greatest extent possible, only implement application logic as
  synchronizations, and organize them under the `syncs/` folder. You may use
  whatever sub-file/folder structure that helps keep things clear, but remember
  to register all synchronizations with the same engine.
