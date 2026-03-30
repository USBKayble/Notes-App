# Mistral Notes

Mistral Notes is an AI-accelerated note-taking application designed to streamline the way you capture, organize, and refine your thoughts. Leveraging the power of Mistral AI models and Next.js, it offers a rich set of features including live transcription, AI-assisted grammar correction, intelligent summarization, and seamless GitHub synchronization.

## Features

- **Rich Markdown Editor:** Built with Milkdown, featuring support for math (KaTeX), GFM, and drag-and-drop file support.
- **AI Chat Assistant:** A dedicated Mistral chat sidebar that can propose changes to your notes, explain concepts, and assist with content generation.
- **Live Transcription:** Record audio directly in the app and have it transcribed and cleaned up automatically using Mistral AI models.
- **AI-Powered Workflows:**
  - **Grammar Checking:** Automatically suggest or apply grammar corrections as you type.
  - **Auto-Organization:** Intelligently categorize and structure your notes.
  - **Summarization:** Generate concise summaries of your notes or specific highlighted sections.
  - **Media & OCR:** Extract text from images and process media files seamlessly.
- **GitHub Integration:** Sync your notes directly to a GitHub repository of your choice.
- **Offline Mode:** Continue working without an internet connection; changes are queued and synced automatically when you're back online.

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Authentication:** [NextAuth.js](https://next-auth.js.org/) (GitHub OAuth & Local Guest mode)
- **AI Integration:** [@mistralai/mistralai](https://github.com/mistralai/client-js)
- **Editor:** [Milkdown](https://milkdown.dev/) & [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- **GitHub API:** [Octokit](https://github.com/octokit/rest.js)

## Getting Started

### Prerequisites

- Node.js (v18 or newer recommended)
- A GitHub account (for GitHub sync)
- A Mistral AI API key

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd notes-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Set up environment variables:**
   Create a `.env.local` file in the root of the project and add the following variables:
   ```env
   MISTRAL_API_KEY=your_mistral_api_key_here
   GITHUB_ID=your_github_oauth_client_id
   GITHUB_SECRET=your_github_oauth_client_secret
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your_nextauth_secret_here
   ```

   *Note: For local testing without GitHub credentials, the app falls back to mock credentials, but GitHub sync will not function correctly.*

4. **Run the development server:**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

5. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000) to see the application in action.

## Usage

1. **Sign In:** Use the GitHub provider to authenticate and grant access to your repositories.
2. **Select Repository:** Open settings (gear icon) and configure your target `owner/repo` for saving notes.
3. **Configure AI Models:** In settings, you can customize which Mistral models are used for transcription, grammar, summarization, and media processing.
4. **Start Typing:** Use the editor to take notes, drop files, or record audio for live transcription.
5. **Save:** Changes are auto-saved locally and pushed to your configured GitHub repository when online.

## License

This project is licensed under the MIT License.
