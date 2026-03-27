import { readFileSync } from 'fs'
import { join } from 'path'

export default function HomePage() {
  const html = readFileSync(join(process.cwd(), 'public', 'landing.html'), 'utf8')
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}
