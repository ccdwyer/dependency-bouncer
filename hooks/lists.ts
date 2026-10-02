// Well-known package names. A new name within a couple of edits of one of these,
// and not itself on the list, is a likely typosquat.
export const POPULAR_NPM = new Set([
  'react', 'react-dom', 'react-native', 'next', 'vue', 'nuxt', 'svelte', 'angular', 'preact', 'solid-js',
  'express', 'koa', 'fastify', 'hapi', 'nestjs', 'hono', 'axios', 'node-fetch', 'got', 'ky', 'superagent',
  'lodash', 'underscore', 'ramda', 'moment', 'dayjs', 'date-fns', 'luxon', 'uuid', 'nanoid', 'chalk',
  'commander', 'yargs', 'minimist', 'inquirer', 'ora', 'debug', 'dotenv', 'cross-env', 'rimraf', 'mkdirp',
  'glob', 'fast-glob', 'chokidar', 'fs-extra', 'semver', 'typescript', 'ts-node', 'tsx', 'esbuild', 'vite',
  'webpack', 'rollup', 'parcel', 'babel-loader', 'eslint', 'prettier', 'jest', 'vitest', 'mocha', 'chai',
  'sinon', 'cypress', 'playwright', 'puppeteer', 'supertest', 'nodemon', 'concurrently', 'husky',
  'lint-staged', 'zod', 'yup', 'joi', 'ajv', 'class-validator', 'mongoose', 'sequelize', 'prisma',
  'typeorm', 'knex', 'pg', 'mysql', 'mysql2', 'sqlite3', 'redis', 'ioredis', 'mongodb', 'graphql',
  'apollo-server', 'socket.io', 'ws', 'jsonwebtoken', 'bcrypt', 'bcryptjs', 'passport', 'helmet', 'cors',
  'body-parser', 'cookie-parser', 'multer', 'morgan', 'winston', 'pino', 'bunyan', 'redux',
  'react-redux', 'zustand', 'mobx', 'jotai', 'recoil', 'immer', 'rxjs', 'react-router', 'react-router-dom',
  'react-query', 'swr', 'formik', 'react-hook-form', 'styled-components', 'emotion', 'tailwindcss',
  'postcss', 'autoprefixer', 'sass', 'less', 'classnames', 'clsx', 'framer-motion', 'three', 'd3',
  'chart.js', 'recharts', 'electron', 'expo', 'react-native-reanimated', 'react-native-screens',
  'react-native-gesture-handler', 'react-native-svg', 'react-native-mmkv', 'openai', 'stripe', 'twilio',
  'aws-sdk', 'firebase', 'firebase-admin', 'sharp', 'jimp', 'cheerio', 'jsdom', 'marked', 'markdown-it',
  'highlight.js', 'prismjs', 'handlebars', 'ejs', 'pug', 'nunjucks', 'qs', 'query-string', 'colors',
  'kleur', 'picocolors', 'boxen', 'execa', 'shelljs', 'zx', 'cross-spawn', 'tslib', 'core-js',
  'regenerator-runtime', 'bluebird', 'async', 'p-limit', 'p-queue', 'eventemitter3', 'nodemailer',
  'validator', 'xml2js', 'yaml', 'js-yaml', 'toml', 'ini', 'csv-parse', 'papaparse', 'xlsx', 'pdfkit',
  'archiver', 'adm-zip', 'tar', 'request', 'form-data', 'mime', 'mime-types', 'serve', 'http-server',
  'pm2', 'forever', 'turbo', 'nx', 'lerna', 'changesets', 'storybook', 'msw', 'nock', 'color', 'querystring',
  'punycode', 'path', 'events', 'util', 'buffer', 'process', 'stream', 'string_decoder', 'url', 'assert',
  '@prisma/client', '@types/node', '@types/react', '@babel/core', '@angular/core', '@nestjs/core',
  '@tanstack/react-query', '@reduxjs/toolkit', '@testing-library/react', '@expo/vector-icons',
  '@react-navigation/native', '@aws-sdk/client-s3', '@sentry/node', '@mui/material', '@emotion/react',
  '@supabase/supabase-js', '@anthropic-ai/sdk', '@vercel/node', '@octokit/rest', '@vitejs/plugin-react',
])

export const POPULAR_PYPI = new Set([
  'requests', 'numpy', 'pandas', 'scipy', 'matplotlib', 'seaborn', 'scikit-learn', 'tensorflow', 'torch',
  'keras', 'flask', 'django', 'fastapi', 'uvicorn', 'gunicorn', 'starlette', 'pydantic', 'sqlalchemy',
  'alembic', 'psycopg2', 'psycopg2-binary', 'pymysql', 'redis', 'celery', 'boto3', 'botocore', 'awscli',
  'pytest', 'pytest-cov', 'tox', 'nose', 'mock', 'coverage', 'black', 'flake8', 'pylint', 'mypy', 'ruff',
  'isort', 'click', 'typer', 'rich', 'tqdm', 'colorama', 'pyyaml', 'toml', 'tomli', 'python-dotenv',
  'jinja2', 'markupsafe', 'werkzeug', 'itsdangerous', 'urllib3', 'certifi', 'chardet', 'idna',
  'charset-normalizer', 'httpx', 'aiohttp', 'beautifulsoup4', 'lxml', 'scrapy', 'selenium', 'playwright',
  'pillow', 'opencv-python', 'imageio', 'openai', 'anthropic', 'transformers', 'langchain', 'tiktoken',
  'setuptools', 'wheel', 'pip', 'virtualenv', 'poetry', 'six', 'attrs', 'cryptography', 'pyjwt',
  'paramiko', 'docker', 'kubernetes', 'protobuf', 'grpcio', 'jupyter', 'notebook', 'ipython', 'networkx',
  'sympy', 'statsmodels', 'xgboost', 'lightgbm', 'plotly', 'dash', 'streamlit', 'gradio', 'arrow',
  'pendulum', 'python-dateutil', 'pytz', 'marshmallow', 'orjson', 'ujson', 'simplejson', 'psycopg',
  'pytest-mock', 'pytest-asyncio', 'types-requests', 'typing-extensions',
])

// Scopes of well-known npm organisations; a new scope one typo away is suspicious.
export const POPULAR_SCOPES = new Set([
  'angular', 'babel', 'types', 'nestjs', 'react-navigation', 'aws-sdk', 'tanstack', 'expo', 'mui', 'testing-library',
  'vue', 'prisma', 'sentry', 'storybook', 'typescript-eslint', 'reduxjs', 'apollo', 'emotion', 'radix-ui',
  'vitejs', 'sveltejs', 'nuxt', 'trpc', 'supabase', 'firebase', 'google-cloud', 'azure', 'octokit', 'shopify',
  'react-native', 'react-native-community', 'swc', 'vercel', 'anthropic-ai', 'openai',
])

// Groups of packages that do the same job; adding one when the project has another is worth a mention.
export const EQUIVALENTS: string[][] = [
  ['moment', 'dayjs', 'date-fns', 'luxon'],
  ['axios', 'node-fetch', 'got', 'ky', 'superagent', 'request'],
  ['lodash', 'underscore', 'ramda'],
  ['chalk', 'kleur', 'picocolors', 'colors'],
  ['jest', 'vitest', 'mocha'],
  ['zod', 'yup', 'joi', 'ajv'],
  ['winston', 'pino', 'bunyan'],
  ['uuid', 'nanoid'],
  ['redux', 'zustand', 'mobx', 'jotai', 'recoil'],
  ['bcrypt', 'bcryptjs'],
  ['yaml', 'js-yaml'],
  ['classnames', 'clsx'],
  ['requests', 'httpx', 'aiohttp'],
  ['black', 'ruff'],
  ['flake8', 'pylint', 'ruff'],
]

// Optimal string alignment distance: Levenshtein with an adjacent swap costing 1.
export function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  const at = (i: number, j: number) => d[i]?.[j] ?? 99
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let best = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) best = Math.min(best, at(i - 2, j - 2) + 1)
      const row = d[i]
      if (row !== undefined) row[j] = best
    }
  }
  return at(a.length, b.length)
}

// The popular name this one imitates, if any. Separators are compared loosely
// (`react_dom` vs `react-dom`), short names need to be closer, and a scoped name
// is judged by its scope (`@angulr/core` imitates `@angular`).
export function lookalike(name: string, popular: Set<string>, scopes: Set<string> = new Set()): string | null {
  if (popular.has(name)) return null
  if (name.startsWith('@')) {
    const scope = name.slice(1, name.indexOf('/'))
    // A real scope: compare the whole name with the well-known packages under it.
    if (scopes.has(scope)) {
      const siblings = new Set([...popular].filter(p => p.startsWith(`@${scope}/`)))
      for (const s of siblings) if (distance(name, s) <= 2) return s
      return null
    }
    const twin = closest(scope, scopes)
    return twin === null ? null : `@${twin}`
  }
  return closest(name, popular)
}

function closest(name: string, known: Set<string>): string | null {
  const loose = (s: string) => s.replace(/[-_.]/g, '')
  const limit = name.length >= 7 ? 2 : name.length >= 4 ? 1 : 0
  for (const k of known) {
    if (loose(k) === loose(name)) return k
    if (limit > 0 && distance(name, k) <= limit) return k
  }
  return null
}
