# Electron Code Processor
This is an Electron application that allows interactive source code processing, simplifying and converting it to another language with the help of Artificial Intelligence APIs. The application is built with TypeScript and uses a step-by-step user interface to guide users through the process.

## YouTube Video
pt-br

[![Assista ao vídeo](https://img.youtube.com/vi/V4Y_lPRBVVY/0.jpg)](https://youtu.be/V4Y_lPRBVVY)



A desktop application to process source code in steps:
1. Select the original source code
![App screenshot](/public/1.png)
2. Select output folders, modify the prompt, and set conversion options
![App screenshot](/public/2.0.png)
![App screenshot](/public/2.1.png)
3. Apply simplifications (remove comments, reduce keywords, minify) to reduce code size/tokens
![App screenshot](/public/3.0.png)
![App screenshot](/public/3.1.png)
4. Convert to another language using AI APIs (OpenAI, Google Gemini, or Anthropic Claude)
![App screenshot](/public/4.0.png)
![App screenshot](/public/4.1.png)
5. View results and analyze the code with AI for further modifications.
![App screenshot](/public/5.0.png)!
![App screenshot](/public/5.1.png)!



## Cost
![alt text](/public/cost.png)


## Features

- Step-by-step user interface
- Source and destination folder selection
- Customizable code simplification options
- Integration with multiple AI APIs for code conversion
- Real-time progress visualization
- Detailed results summary

## Requirements

- Node.js 20+
- npm

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Pquar/electron-code-migrator
cd electron-code-migrator
npm install
```

## Build and Run

To compile TypeScript and run the application:

```bash
npm run build   # Compile TypeScript
npm start       # Start Electron application
```

Or use the development command that compiles and starts the application:

```bash
npm run dev
```

## Development Mode

For development, you can use watch mode that automatically recompiles when files are changed:

```bash
npm run dev
# or
npm run watch
```

## Application Usage

1. **Step 1**: Select the base folder with the original source code.
2. **Step 2**: Configure output folders (intermediate and final), simplification options, and conversion options. Review settings.
3. **Step 3**: Start the code minification process.
4. **Step 4**: Start the conversion process with the selected API.
5. **Step 5**: View results and make additional adjustments as needed.

## API Configuration

To use the conversion features, you'll need API keys:

- **OpenAI (GPT)**: Get a key at [https://platform.openai.com](https://platform.openai.com)
- **Google Gemini**: Get a key at [https://ai.google.dev](https://ai.google.dev)
- **Anthropic Claude**: Get a key at [https://www.anthropic.com/](https://www.anthropic.com/)


## License

MIT