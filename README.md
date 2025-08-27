# Code Structure Evaluator GitHub Action

An ultra-minimal GitHub Action that evaluates code repositories based on structure and organization using LLM technology. This action analyzes your codebase and provides a score with detailed feedback in a markdown report.

## Features

- **Ultra-minimal design**: Focuses only on essential functionality
- **LLM-powered evaluation**: Uses OpenAI's GPT-4 to evaluate code structure
- **Comprehensive analysis**: Reviews directory structure, code quality, and architecture
- **Detailed reporting**: Generates a markdown report with scores and explanations
- **Flexible rubric**: Uses embedded rubric by default or accepts custom rubric
- **Workflow integration**: Outputs score and explanation for use in GitHub workflows

## Setup

### Prerequisites

1. An OpenAI API key with access to GPT-4
2. A GitHub repository with the code you want to evaluate

### Installation

1. Create a GitHub Secret named `OPENAI_API_KEY` with your OpenAI API key
2. Create a workflow file in your repository at `.github/workflows/evaluate-code.yml`

## Usage

### Basic Usage

Add this GitHub Action to your workflow:

```yaml
name: Code Structure Evaluation

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
  workflow_dispatch:  # Allows manual triggering

jobs:
  evaluate:
    runs-on: ubuntu-latest
    permissions:
      contents: write      # Required to commit the Result.md file
    steps:
      # Step 1: Checkout the repository code
      - name: Checkout code
        uses: actions/checkout@v3
        with:
          fetch-depth: 0

      # Step 2: Set up Node.js environment
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '16'

      # Step 3: Run the Code Structure Evaluator action
      - name: Evaluate Code Structure
        uses: your-username/code-structure-evaluator@v1
        with:
          api-key: ${{ secrets.OPENAI_API_KEY }}
        id: evaluation

      # Step 4: Commit the Result.md file to the repository
      - name: Commit Result.md
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add Result.md
          git commit -m "Add code structure evaluation result"
          git push

      # Step 5: Upload the report as a workflow artifact
      - name: Upload Report as Artifact
        uses: actions/upload-artifact@v3
        with:
          name: code-structure-report
          path: Result.md

### Using a Custom Rubric

By default, the action uses an embedded rubric that evaluates code organization, quality, and architecture. If you want to use your own rubric, create a YAML file in your repository and specify its path:

```yaml
- name: Evaluate Code Structure
  uses: your-username/code-structure-evaluator@v1
  with:
    api-key: ${{ secrets.OPENAI_API_KEY }}
    rubric: './path/to/custom-rubric.yml'
```

### Custom Rubric Format

The rubric file must be in YAML format with the following structure:

```yaml
category_name:
  max_score: 10  # Maximum points for this category
  description: "Description of what this category evaluates"
  criteria:
    - "Criterion 1"
    - "Criterion 2"
    - "Criterion 3"

another_category:
  max_score: 10
  description: "Description of another evaluation category"
  criteria:
    - "Criterion 1"
    - "Criterion 2"
```

### Example Custom Rubric

```yaml
code_organization:
  max_score: 10
  description: "Evaluate how well the code is organized"
  criteria:
    - "Files are logically organized"
    - "Related functionality is grouped together"
    - "Clear separation of concerns"

code_quality:
  max_score: 10
  description: "Evaluate the quality of the code"
  criteria:
    - "Code is readable and well-formatted"
    - "Consistent coding style"
    - "Proper error handling"

architecture:
  max_score: 10
  description: "Evaluate the overall architecture"
  criteria:
    - "Appropriate use of design patterns"
    - "Clear component boundaries"
    - "Minimal coupling between components"
```

## Action Inputs and Outputs

### Inputs

| Input    | Description                                | Required | Default |
|----------|--------------------------------------------|----------|--------|
| api-key  | OpenAI API key for LLM evaluation          | Yes      | -      |
| rubric   | Path to custom rubric file (YAML format)   | No       | -      |

### Outputs

| Output      | Description                                        |
|-------------|----------------------------------------------------|  
| score       | The total score based on the rubric                |
| explanation | Brief explanation of the evaluation (truncated)    |

## How It Works

1. **Repository Analysis**: The action scans your repository and collects all code files
2. **LLM Evaluation**: It sends the code to OpenAI's GPT-4 along with the rubric
3. **Report Generation**: The LLM evaluates the code and generates a detailed markdown report
4. **Output Creation**: The action creates a Result.md file with the evaluation
5. **Workflow Integration**: The score and explanation are available as outputs for use in your workflow

## Result.md Format

The generated Result.md file contains:

- A summary with the total score
- Overall feedback about the codebase
- Detailed evaluation for each category in the rubric
- Individual scores and explanations for each category

## Best Practices

1. **Security**: Always store your OpenAI API key as a GitHub secret
2. **Permissions**: Ensure your workflow has `contents: write` permission to commit the Result.md file
3. **Custom Rubrics**: Create rubrics specific to your project's needs and standards
4. **CI Integration**: Integrate the action into your CI pipeline for regular code quality checks

## Troubleshooting

- If the action fails with API errors, check your OpenAI API key permissions
- If the commit step fails, ensure your workflow has proper write permissions
- For large repositories, consider using a more specific rubric focused on key areas

## License

MIT
