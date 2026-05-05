import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Actions sets GITHUB_PAGES_BASE to "/repo/" for project sites, "/" for USER.github.io
const base = process.env.GITHUB_PAGES_BASE ?? '/'

export default defineConfig({
  plugins: [react()],
  base,
})
