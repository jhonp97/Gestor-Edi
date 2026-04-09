import { defineConfig } from '@prisma/config'

export default defineConfig({
  migrations: {
    url: process.env.DIRECT_URL,
  },
})