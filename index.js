const { glob } = require('glob');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

const DEFAULT_RUBRIC = {
  code_organization: {
    max_score: 10,
    description: 'Evaluate how well the code is organized, including file structure, module organization, and code grouping.',
    criteria: [
      'Files are logically organized',
      'Related functionality is grouped together',
      'Clear separation of concerns',
      'Consistent naming conventions for files and directories'
    ]
  },
  code_quality: {
    max_score: 10,
    description: 'Evaluate the quality of the code, including readability, maintainability, and adherence to best practices.',
    criteria: [
      'Code is readable and well-formatted',
      'Consistent coding style',
      'Proper error handling',
      'No code smells or anti-patterns',
      'Appropriate use of comments'
    ]
  },
  architecture: {
    max_score: 10,
    description: 'Evaluate the overall architecture of the codebase, including design patterns, component interaction, and system structure.',
    criteria: [
      'Appropriate use of design patterns',
      'Clear component boundaries',
      'Minimal coupling between components',
      'Consistent architectural approach'
    ]
  }
};


async function run() {
  try {
    const apiKey = process.env.INPUT_API_KEY;
    const rubricPath = process.env.INPUT_RUBRIC;
    console.log('Starting code evaluation...');
    
    let rubric = DEFAULT_RUBRIC;
    if (rubricPath) {
      try {
        const rubricContent = await fs.readFile(rubricPath, 'utf8');
        rubric = yaml.load(rubricContent);
        console.log('Using custom rubric from:', rubricPath);
      } catch (error) {
        console.log(`Error loading custom rubric: ${error.message}. Using default rubric.`);
      }
    } else {
      console.log('Using default embedded rubric');
    }
    
    const repoPath = process.env.GITHUB_WORKSPACE || '.';
    const files = await getRepositoryFiles(repoPath);
    console.log(`Found ${files.length} files to evaluate`);
    
    const fileContents = await readFilesContent(files);
    const result = await evaluateWithLLM(fileContents, apiKey, rubric);
    
    fs.appendFile(process.env.GITHUB_OUTPUT, `score=${result.score}\n`, 'utf8');
    fs.appendFile(process.env.GITHUB_OUTPUT, `explanation=${result.markdownReport.substring(0, 500).replace(/\n/g, '%0A')}\n`, 'utf8');
    
    const resultFilePath = path.join(repoPath, 'Result.md');
    await fs.writeFile(resultFilePath, result.markdownReport);
    
    console.log('Evaluation completed successfully');
    console.log(`Total Score: ${result.score}/${result.maxScore}`);
    console.log('Result.md file has been created. It will be committed by the workflow.');
  } catch (error) {
    console.error(`Action failed: ${error.message}`);
    process.exit(1);
  }
}

async function evaluateWithLLM(fileContents, apiKey, rubric) {
  try {
    const fileListingString = fileContents.map(file => {
      const relativePath = path.relative(process.env.GITHUB_WORKSPACE || '.', file.path);
      return `${relativePath} (${file.size} bytes)`;
    }).join('\n');
    
    const codeFiles = fileContents
      .filter(file => {
        const ext = path.extname(file.path).toLowerCase();
        return ['.js', '.py', '.java', '.ts', '.jsx', '.tsx', '.html', '.css', '.cpp', '.c', '.h', '.go', '.rb'].includes(ext);
      })
      .slice(0, 3);
    
    const codeSamples = codeFiles.map(file => {
      const relativePath = path.relative(process.env.GITHUB_WORKSPACE || '.', file.path);
      const content = file.content.length > 300 ? 
        file.content.substring(0, 300) + '\n[truncated]' : 
        file.content;
      return `\n--- ${relativePath} ---\n${content}`;
    }).join('\n');
    
    let rubricText = '';
    let maxPossibleScore = 0;
    
    for (const [category, details] of Object.entries(rubric)) {
      rubricText += `Category: ${category}\nMax Score: ${details.max_score}\nDescription: ${details.description}\nCriteria:\n`;
      for (const criterion of details.criteria) {
        rubricText += `- ${criterion}\n`;
      }
      rubricText += '\n';
      maxPossibleScore += details.max_score;
    }
    
    const prompt = `TASK: Evaluate this code repository based on the rubric below.

${rubricText}

REPOSITORY FILES:
${fileListingString}

CODE SAMPLES:
${codeSamples}

INSTRUCTIONS:
1. Evaluate the repository based on the rubric.
2. For each category, provide a score and explanation.
3. Calculate a total score (maximum ${maxPossibleScore} points).
4. Format your response in two parts:

PART 1: A complete markdown report with the following structure:
# Code Structure Evaluation Report

## Summary
**Total Score:** [score]/${maxPossibleScore}

## Overall Feedback
[Your overall feedback here]

## Detailed Evaluation

### [Category Name]
**Score:** [category score]/[category max score]
[Detailed explanation for this category]

[Repeat for each category]

---

This report was generated by the Code Structure Evaluator GitHub Action.

PART 2: A JSON object with just the score and total:
{
  "score": number,
  "maxScore": ${maxPossibleScore}
}`;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: 'You are an expert code evaluator assistant.' },
          { role: 'user', content: prompt }
        ]
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`LLM API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }
    
    const data = await response.json();
    const content = data.choices[0].message.content;
    
    const markdownMatch = content.match(/# Code Structure Evaluation Report[\s\S]*?(?=\n\nPART 2:|$)/);
    const jsonMatch = content.match(/\{\s*"score"\s*:\s*(\d+)\s*,\s*"maxScore"\s*:\s*(\d+)\s*\}/);
    
    if (!markdownMatch) {
      throw new Error('Failed to extract markdown report from LLM response');
    }
    
    let score = 0;
    let maxScore = maxPossibleScore;
    
    if (jsonMatch) {
      const jsonData = JSON.parse(jsonMatch[0]);
      score = jsonData.score;
      maxScore = jsonData.maxScore;
    } else {
      const scoreMatch = markdownMatch[0].match(/\*\*Total Score:\*\* (\d+)\/(\d+)/);
      if (scoreMatch) {
        score = parseInt(scoreMatch[1]);
        maxScore = parseInt(scoreMatch[2]);
      }
    }
    
    return {
      markdownReport: markdownMatch[0],
      score: score,
      maxScore: maxScore
    };
  } catch (error) {
    throw new Error(`Evaluation failed: ${error.message}`);
  }
}


async function getRepositoryFiles(repoPath) {
  try {
    const excludePatterns = [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/Result.md',
      '**/*.{png,jpg,jpeg,gif,svg,ico,woff,woff2,ttf,eot,mp3,mp4,zip,tar,gz}'
    ];
    
    return await glob('**/*', {
      cwd: repoPath,
      absolute: true,
      nodir: true,
      ignore: excludePatterns,
    });
  } catch (error) {
    throw new Error(`Failed to get repository files: ${error.message}`);
  }
}


async function readFilesContent(files) {
  try {
    const fileContents = [];
    
    for (const file of files) {
      try {
        const stats = await fs.stat(file);
        
        if (stats.size > 500 * 1024) {
          console.log(`Skipping large file: ${file} (${stats.size} bytes)`);
          fileContents.push({
            path: file,
            content: '[File too large to include in evaluation]',
            size: stats.size
          });
          continue;
        }
        
        const content = await fs.readFile(file, 'utf8').catch(() => 
          '[Binary file not included in evaluation]'
        );
        
        fileContents.push({ path: file, content, size: stats.size });
      } catch (error) {
        console.error(`Error processing file ${file}: ${error.message}`);
      }
    }
    
    return fileContents;
  } catch (error) {
    throw new Error(`Failed to read file contents: ${error.message}`);
  }
}

run();
