#!/usr/bin/env node

import readline from 'readline';
import colors from 'colors';
import { CloneRepository } from './src/cloneRepository.js';
import { 
  printTree, 
  simpleTreePrint, 
  exportTreeToFile, 
  exportFileContentsToFile, 
  generateDirectorySummary 
} from './src/traverseRepository.js';

colors.setTheme({
  info: 'blue',
  success: 'green',
  error: 'red',
  menu: 'yellow'
});

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to display the menu
function showMenu(repoPath) {
  console.log('\n' + '='.repeat(50));
  console.log('Repository Explorer - Choose an option:'.menu);
  console.log('='.repeat(50));
  console.log('1. Print Tree'.menu);
  console.log('2. Simple Tree Print (with file sizes)'.menu);
  console.log('3. Export Tree to File'.menu);
  console.log('4. Export File Contents to File'.menu);
  console.log('5. Generate Directory Summary'.menu);
  console.log('6. Exit'.menu);
  console.log('='.repeat(50));
  
  rl.question('Enter your choice (1-6): ', (choice) => {
    handleMenuChoice(choice, repoPath);
  });
}

// Function to handle menu choices
function handleMenuChoice(choice, repoPath) {
  switch (choice) {
    case '1':
      console.log('\nPrinting repository tree structure:'.info);
      printTree(repoPath);
      showMenu(repoPath);
      break;
      
    case '2':
      simpleTreePrint(repoPath);
      showMenu(repoPath);
      break;
      
    case '3':
      rl.question('Enter output file path (default: ./repo-tree.txt): ', (outputPath) => {
        const filePath = outputPath || './repo-tree.txt';
        exportTreeToFile(repoPath, filePath);
        showMenu(repoPath);
      });
      break;
      
    case '4':
      rl.question('Enter output file path (default: ./repo-contents.txt): ', (outputPath) => {
        const filePath = outputPath || './repo-contents.txt';
        rl.question('Enter extensions to include (comma separated, leave empty for all): ', (extensions) => {
          const extArray = extensions ? extensions.split(',').map(e => e.trim().startsWith('.') ? e.trim() : `.${e.trim()}`) : null;
          exportFileContentsToFile(repoPath, filePath, {
            exclude: ['node_modules', '.git', 'dist', 'build'],
            extensions: extArray
          });
          showMenu(repoPath);
        });
      });
      break;
      
    case '5':
      rl.question('Enter output file path (default: ./repo-summary.txt): ', (outputPath) => {
        const filePath = outputPath || './repo-summary.txt';
        generateDirectorySummary(repoPath, filePath);
        showMenu(repoPath);
      });
      break;
      
    case '6':
      console.log('Exiting program. Goodbye!'.success);
      rl.close();
      break;
      
    default:
      console.log('Invalid choice, please try again.'.error);
      showMenu(repoPath);
      break;
  }
}

// Start the application
console.log('Repository Explorer'.success);
console.log('='.repeat(50));

rl.question('Provide Repository URL: ', async (repoUrl) => {
  if (!repoUrl) {
    console.log('No repository URL provided. Exiting.'.error);
    rl.close();
    return;
  }
  
  // Ask if user wants to specify a target path
  rl.question('Enter target path (leave empty for temporary directory): ', async (targetPath) => {
    // Ask if user wants to clone a specific branch
    rl.question('Enter branch name (leave empty for default branch): ', async (branch) => {
      console.log('\nCloning repository, please wait...'.info);
      
      const cloneOptions = {
        shallow: true
      };
      
      if (targetPath) {
        cloneOptions.targetPath = targetPath;
      }
      
      if (branch) {
        cloneOptions.branch = branch;
      }
      
      const result = await CloneRepository(repoUrl, cloneOptions);
      
      if (result.success) {
        console.log(`\nRepository cloned to: ${result.targetPath}`.success);
        showMenu(result.targetPath);
      } else {
        console.log(result.message.error);
        rl.question('Do you want to specify a local directory instead? (y/n): ', (answer) => {
          if (answer.toLowerCase() === 'y') {
            rl.question('Enter the path to local directory: ', (localPath) => {
              console.log(`Using local directory: ${localPath}`.info);
              showMenu(localPath);
            });
          } else {
            console.log('Program closing.'.info);
            rl.close();
          }
        });
      }
    });
  });
});

// Handle program exit
rl.on('close', () => {
  console.log('Program closed.'.info);
  process.exit(0);
});