import { Fragment } from 'react'

// 把純文字中的網址轉成可點擊連結（安全：不使用 dangerouslySetInnerHTML）。
// 只吃 URL 合法的 ASCII 字元，遇到中文或空白就停，避免把後面的中文一起吞進網址。
const URL_RE = /(https?:\/\/[\w\-.~:/?#[\]@!$&'()*+,;=%]+)/g
// 網址結尾常見的標點不算網址的一部分
const TRAILING = /[。，、！？.,!?)）】」』>]+$/

export function Linkify({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_RE).map((part, i) => {
        if (!/^https?:\/\//.test(part)) return <Fragment key={i}>{part}</Fragment>
        const trail = part.match(TRAILING)?.[0] ?? ''
        const url = trail ? part.slice(0, -trail.length) : part
        return (
          <Fragment key={i}>
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="break-all text-accent underline underline-offset-2 hover:opacity-80">
              {url}
            </a>
            {trail}
          </Fragment>
        )
      })}
    </>
  )
}
