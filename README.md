# ご教授ください

ProtoPedia: https://protopedia.net/prototype/8195

## 概要

**ご教授ください**は、教授・研究室向けの連絡文を自然で丁寧な日本語に整えるためのWebアプリです。  
文章生成と語彙学習を組み合わせ、学生が「伝わる文面」を継続的に作れるように支援します。

## 主な機能

- 文章生成: 入力した下書きを、相手に合わせた丁寧な文面へ整形
- メール作成: 用件をもとに教授宛てメール文案を作成
- 語彙力貯金: 学んだ語彙を登録して蓄積
- 語彙コピー: 登録済み語彙を別の相手（教授）向けに再利用
- 語彙力判定: 語彙の蓄積量に応じてランク表示
- Googleログイン: 認証後にユーザー情報をバックエンドへ連携

## 技術スタック

- フロントエンド: Next.js (App Router), TypeScript
- バックエンド: Go, Echo
- ORM/DB: GORM, PostgreSQL
- 認証: Auth.js (NextAuth) + Google Provider
- 実行環境: Docker / Docker Compose

## 画面構成

- `/login`: Googleログイン
- `/generate`: 文章生成
- `/mail`: メール作成
- `/vocabulary`: 語彙力貯金
- `/goiryoku`: 語彙力判定

## ローカル起動（Docker）

前提:

- Docker / Docker Compose が使えること
- Google OAuth クライアントが作成済みであること

1. 環境変数を設定

`frontend/.env.local`

```env
GEMINI_API_KEY=your-gemini-api-key
AUTH_SECRET=your-auth-secret
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret
```

`.env`
```env
GEMINI_API_KEY=your-gemini-api-key
```

1. コンテナ起動

```bash
docker compose up --build
```

3. アクセス

- フロントエンド: `http://localhost:3000`
- バックエンド: `http://localhost:8080`
- PostgreSQL: `localhost:5432`
