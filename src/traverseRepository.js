import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import colors from "colors";

colors.setTheme({
  info: "blue",
  success: "green",
  error: "red",
});

/**
 * Print a directory tree structure to the console with comprehensive error handling
 * @param {string} directoryPath - The path to the directory to print
 * @param {Object} options - Configuration options
 * @param {string} options.prefix - Prefix for the current line (used for recursion)
 * @param {number} options.maxDepth - Maximum depth to traverse (-1 for unlimited)
 * @param {Array<string>} options.exclude - Array of directory/file names to exclude
 * @param {boolean} options.showHidden - Whether to show hidden files (starting with .)
 * @param {boolean} options.showSize - Whether to show file sizes
 * @param {function} options.logger - Logging function (defaults to console.log)
 * @returns {Object} Result object with success status and error if any
 */
function printTree(directoryPath, options = {}) {
  // Default options
  const {
    prefix = "",
    maxDepth = -1,
    exclude = [],
    showHidden = false,
    showSize = false,
    currentDepth = 0,
    logger = console.log,
  } = options;

  // Result object to track success/failure
  const result = { success: true, error: null };

  try {
    // Validate input
    if (!directoryPath || typeof directoryPath !== "string") {
      throw new Error("Invalid directory path provided");
    }

    // Resolve relative paths
    const resolvedPath = path.resolve(directoryPath);

    // Check if directory exists
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Directory does not exist: ${resolvedPath}`);
    }

    // Check if path is actually a directory
    const pathStats = fs.statSync(resolvedPath);
    if (!pathStats.isDirectory()) {
      throw new Error(`Path is not a directory: ${resolvedPath}`);
    }

    // Check if we've reached max depth
    if (maxDepth >= 0 && currentDepth > maxDepth) {
      return result;
    }

    // Print the current directory name at the root level
    if (currentDepth === 0) {
      const dirName = path.basename(resolvedPath);
      logger(`${prefix}${dirName}/`.info);
    }

    // Read directory contents
    let items;
    try {
      items = fs.readdirSync(resolvedPath);
    } catch (err) {
      // Handle permission errors or other read failures
      logger(`${prefix}├── [Error reading directory: ${err.message}]`.error);
      result.error = err;
      result.success = false;
      return result;
    }

    // Filter items based on options
    items = items.filter((item) => {
      // Filter hidden files if not showing them
      if (!showHidden && item.startsWith(".")) {
        return false;
      }

      // Filter excluded items
      if (exclude.includes(item)) {
        return false;
      }

      return true;
    });

    // Sort items (directories first, then files)
    items.sort((a, b) => {
      try {
        const aPath = path.join(resolvedPath, a);
        const bPath = path.join(resolvedPath, b);
        const aIsDir = fs.statSync(aPath).isDirectory();
        const bIsDir = fs.statSync(bPath).isDirectory();

        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.localeCompare(b);
      } catch (err) {
        // If there's an error accessing the file, treat it as a file
        return 0;
      }
    });

    const lastIndex = items.length - 1;

    // Process each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const isLast = i === lastIndex;
      const fullPath = path.join(resolvedPath, item);
      const connector = isLast ? "└── " : "├── ";

      try {
        const stats = fs.statSync(fullPath);
        const isDir = stats.isDirectory();

        // Format size if option is enabled
        let sizeInfo = "";
        if (showSize && !isDir) {
          sizeInfo = formatFileSize(stats.size);
          sizeInfo = ` (${sizeInfo})`;
        }

        // Print the current item
        logger(
          `${prefix}${connector}${item}${isDir ? "/" : ""}${sizeInfo}`.info
        );

        // Recurse into directories
        if (isDir) {
          const newPrefix = prefix + (isLast ? "    " : "│   ");
          const newOptions = {
            ...options,
            prefix: newPrefix,
            currentDepth: currentDepth + 1,
          };

          // Continue recursion
          const subResult = printTree(fullPath, newOptions);

          // Handle errors in subdirectories
          if (!subResult.success) {
            result.error = subResult.error;
            // Don't set success to false here to continue processing
          }
        }
      } catch (err) {
        // Handle errors for individual files/directories
        logger(`${prefix}${connector}${item} [Error: ${err.message}]`.error);
      }
    }

    // Handle empty directories
    if (items.length === 0) {
      logger(`${prefix}└── [empty]`.info);
    }

    return result;
  } catch (err) {
    // Handle function-level errors
    logger(`Error: ${err.message}`.error);
    return {
      success: false,
      error: err,
    };
  }
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

/**
 * Print a directory tree with default settings
 * @param {string} directoryPath - Path to the directory
 */
function simpleTreePrint(directoryPath) {
  console.log("\nSimple Tree Print:".success);
  return printTree(directoryPath, {
    maxDepth: -1,
    showHidden: false,
    showSize: true,
  });
}

/**
 * Export tree structure to a text file
 * @param {string} directoryPath - Path to the directory to analyze
 * @param {string} outputPath - Path where to save the output file
 * @param {Object} options - Options to pass to printTree
 * @returns {Object} Result object with success status and file path
 */
function exportTreeToFile(
  directoryPath,
  outputPath = "./directory-tree.txt",
  options = {}
) {
  try {
    // Create a collector for the output
    let output = [];
    const logger = (line) => output.push(line.replace(/\u001b\[\d+m/g, "")); // Remove color codes

    // Use the existing printTree function with custom logger
    const treeOptions = { ...options, logger };
    const result = printTree(directoryPath, treeOptions);

    // Write to file
    fs.writeFileSync(outputPath, output.join("\n"), "utf8");

    console.log(
      `Tree structure exported successfully to: ${outputPath}`.success
    );

    return {
      success: true,
      filePath: path.resolve(outputPath),
      error: result.error, // Pass through any non-fatal errors
    };
  } catch (err) {
    console.log(`Failed to export tree: ${err.message}`.error);
    return {
      success: false,
      error: err,
      message: `Failed to export tree: ${err.message}`,
    };
  }
}

/**
 * Generate a text file containing all file contents in the directory
 * @param {string} directoryPath - Path to the directory to analyze
 * @param {string} outputPath - Path where to save the output file
 * @param {Object} options - Configuration options
 * @param {Array<string>} options.exclude - Array of file patterns to exclude
 * @param {boolean} options.showHidden - Whether to include hidden files
 * @param {number} options.maxDepth - Maximum directory depth to traverse
 * @param {Array<string>} options.extensions - File extensions to include (e.g., ['.js', '.txt'])
 * @param {number} options.maxFileSize - Maximum file size in bytes to include
 * @returns {Object} Result object with success status and file path
 */
function exportFileContentsToFile(
  directoryPath,
  outputPath = "./file-contents.txt",
  options = {}
) {
  try {
    // Default options
    const {
      exclude = [],
      showHidden = false,
      maxDepth = -1,
      extensions = null, // null means all extensions
      maxFileSize = 1024 * 1024, // Default 1MB limit per file
      separator = "\n" + "-".repeat(80) + "\n",
    } = options;

    // Validate input
    if (!directoryPath || typeof directoryPath !== "string") {
      throw new Error("Invalid directory path provided");
    }

    // Resolve paths
    const resolvedDirPath = path.resolve(directoryPath);
    const resolvedOutputPath = path.resolve(outputPath);

    // Check if directory exists
    if (!fs.existsSync(resolvedDirPath)) {
      throw new Error(`Directory does not exist: ${resolvedDirPath}`);
    }

    // Check if path is a directory
    const pathStats = fs.statSync(resolvedDirPath);
    if (!pathStats.isDirectory()) {
      throw new Error(`Path is not a directory: ${resolvedDirPath}`);
    }

    // Initialize output file
    fs.writeFileSync(
      resolvedOutputPath,
      `File contents from: ${resolvedDirPath}\n${separator}`,
      "utf8"
    );

    // Process files and collect content
    const fileCount = collectFileContents(resolvedDirPath, resolvedOutputPath, {
      exclude,
      showHidden,
      maxDepth,
      extensions,
      maxFileSize,
      separator,
      currentDepth: 0,
    });

    // Add summary at the end
    fs.appendFileSync(
      resolvedOutputPath,
      `${separator}End of file contents\nTotal files processed: ${fileCount.processed}\nFiles skipped: ${fileCount.skipped}\n`,
      "utf8"
    );

    console.log(
      `File contents exported successfully to: ${outputPath}`.success
    );
    console.log(
      `Files processed: ${fileCount.processed}, Files skipped: ${fileCount.skipped}`
        .info
    );

    return {
      success: true,
      filePath: resolvedOutputPath,
      fileCount,
    };
  } catch (err) {
    console.log(`Failed to export file contents: ${err.message}`.error);
    return {
      success: false,
      error: err,
      message: `Failed to export file contents: ${err.message}`,
    };
  }
}

/**
 * Helper function to recursively collect file contents
 * @private
 */
function collectFileContents(dirPath, outputPath, options) {
  const {
    exclude,
    showHidden,
    maxDepth,
    extensions,
    maxFileSize,
    separator,
    currentDepth,
  } = options;

  // Initialize counters
  let counts = { processed: 0, skipped: 0 };

  // Check max depth
  if (maxDepth >= 0 && currentDepth > maxDepth) {
    return counts;
  }

  try {
    // Read directory
    const items = fs.readdirSync(dirPath);

    // Process each item
    for (const item of items) {
      // Skip hidden files if not showing them
      if (!showHidden && item.startsWith(".")) {
        counts.skipped++;
        continue;
      }

      // Skip excluded patterns
      if (
        exclude.some((pattern) => {
          // Handle glob patterns
          if (pattern.includes("*")) {
            return minimatch(item, pattern);
          }
          return item === pattern;
        })
      ) {
        counts.skipped++;
        continue;
      }

      const fullPath = path.join(dirPath, item);
      const relativePath = path.relative(path.dirname(outputPath), fullPath);

      try {
        const stats = fs.statSync(fullPath);

        // Recurse into directories
        if (stats.isDirectory()) {
          const subCounts = collectFileContents(fullPath, outputPath, {
            ...options,
            currentDepth: currentDepth + 1,
          });
          counts.processed += subCounts.processed;
          counts.skipped += subCounts.skipped;
          continue;
        }

        // Handle files
        // Check file size
        if (stats.size > maxFileSize) {
          fs.appendFileSync(
            outputPath,
            `File: ${relativePath}\n[FILE TOO LARGE: ${formatFileSize(
              stats.size
            )}]\n${separator}`,
            "utf8"
          );
          counts.skipped++;
          continue;
        }

        // Check file extension
        const ext = path.extname(item).toLowerCase();
        if (extensions && extensions.length > 0 && !extensions.includes(ext)) {
          counts.skipped++;
          continue;
        }

        // Read and append file content
        try {
          const content = fs.readFileSync(fullPath, "utf8");
          fs.appendFileSync(
            outputPath,
            `File: ${relativePath}\n\n${content}\n${separator}`,
            "utf8"
          );
          counts.processed++;
        } catch (readErr) {
          // Handle binary files or read errors
          fs.appendFileSync(
            outputPath,
            `File: ${relativePath}\n[UNABLE TO READ: ${readErr.message}]\n${separator}`,
            "utf8"
          );
          counts.skipped++;
        }
      } catch (statErr) {
        fs.appendFileSync(
          outputPath,
          `Path: ${relativePath}\n[ERROR: ${statErr.message}]\n${separator}`,
          "utf8"
        );
        counts.skipped++;
      }
    }
  } catch (err) {
    fs.appendFileSync(
      outputPath,
      `Directory: ${dirPath}\n[ERROR: ${err.message}]\n${separator}`,
      "utf8"
    );
  }

  return counts;
}

/**
 * Generate a summary file with tree structure and important file details
 * @param {string} directoryPath - Path to the directory to analyze
 * @param {string} outputPath - Path where to save the output file
 * @param {Object} options - Configuration options
 * @returns {Object} Result object with success status and file path
 */
function generateDirectorySummary(
  directoryPath,
  outputPath = "./directory-summary.txt",
  options = {}
) {
  try {
    const {
      exclude = ["node_modules", ".git"],
      showHidden = false,
      includeStats = true,
      includeFileCount = true,
      maxDepth = -1,
    } = options;

    // Initialize counters and storage
    const stats = {
      totalFiles: 0,
      totalDirectories: 0,
      totalSize: 0,
      fileTypes: {},
      largestFiles: [],
    };

    // Create output file
    let output = [];
    output.push(`Directory Summary: ${path.resolve(directoryPath)}`);
    output.push(`Generated on: ${new Date().toLocaleString()}`);
    output.push("=".repeat(80));
    output.push("");

    // Generate tree structure
    output.push("Directory Structure:");
    const logger = (line) => output.push(line.replace(/\u001b\[\d+m/g, "")); // Remove color codes
    printTree(directoryPath, {
      prefix: "",
      maxDepth,
      exclude,
      showHidden,
      showSize: false,
      logger,
    });

    if (includeStats || includeFileCount) {
      // Collect statistics about the directory
      collectDirectoryStats(directoryPath, stats, {
        exclude,
        showHidden,
        maxDepth,
        currentDepth: 0,
      });

      output.push("");
      output.push("=".repeat(80));
      output.push("");
      output.push("Directory Statistics:");
      output.push(`- Total Files: ${stats.totalFiles}`);
      output.push(`- Total Directories: ${stats.totalDirectories}`);
      output.push(`- Total Size: ${formatFileSize(stats.totalSize)}`);

      // File types breakdown
      output.push("");
      output.push("File Types:");
      Object.entries(stats.fileTypes)
        .sort((a, b) => b[1].count - a[1].count)
        .forEach(([ext, data]) => {
          output.push(
            `- ${ext || "(no extension)"}: ${
              data.count
            } files (${formatFileSize(data.size)})`
          );
        });

      // Largest files
      output.push("");
      output.push("Largest Files:");
      stats.largestFiles
        .sort((a, b) => b.size - a.size)
        .slice(0, 10)
        .forEach((file) => {
          output.push(`- ${file.path} (${formatFileSize(file.size)})`);
        });
    }

    // Write output to file
    fs.writeFileSync(outputPath, output.join("\n"), "utf8");

    console.log(
      `Directory summary generated successfully to: ${outputPath}`.success
    );

    return {
      success: true,
      filePath: path.resolve(outputPath),
      stats,
    };
  } catch (err) {
    console.log(`Failed to generate directory summary: ${err.message}`.error);
    return {
      success: false,
      error: err,
      message: `Failed to generate directory summary: ${err.message}`,
    };
  }
}

/**
 * Helper function to collect directory statistics
 * @private
 */
function collectDirectoryStats(dirPath, stats, options) {
  const { exclude, showHidden, maxDepth, currentDepth } = options;

  // Check max depth
  if (maxDepth >= 0 && currentDepth > maxDepth) {
    return;
  }

  try {
    // Read directory
    const items = fs.readdirSync(dirPath);

    // Process each item
    for (const item of items) {
      // Skip hidden files if not showing them
      if (!showHidden && item.startsWith(".")) {
        continue;
      }

      // Skip excluded patterns
      if (exclude.some((pattern) => item === pattern)) {
        continue;
      }

      const fullPath = path.join(dirPath, item);

      try {
        const itemStats = fs.statSync(fullPath);

        if (itemStats.isDirectory()) {
          // Count directories
          stats.totalDirectories++;

          // Recurse into directories
          collectDirectoryStats(fullPath, stats, {
            ...options,
            currentDepth: currentDepth + 1,
          });
        } else {
          // Count files
          stats.totalFiles++;
          stats.totalSize += itemStats.size;

          // Track file types
          const ext = path.extname(item).toLowerCase() || "(no extension)";
          if (!stats.fileTypes[ext]) {
            stats.fileTypes[ext] = { count: 0, size: 0 };
          }
          stats.fileTypes[ext].count++;
          stats.fileTypes[ext].size += itemStats.size;

          // Track large files
          stats.largestFiles.push({
            path: fullPath,
            size: itemStats.size,
          });

          // Only keep the 20 largest files in memory
          if (stats.largestFiles.length > 20) {
            stats.largestFiles.sort((a, b) => b.size - a.size);
            stats.largestFiles = stats.largestFiles.slice(0, 20);
          }
        }
      } catch (err) {
        // Skip errors for individual files
      }
    }
  } catch (err) {
    // Skip errors for directories we can't read
  }
}

// A minimatch-like simple pattern matching function
// Only supports * wildcard
function minimatch(string, pattern) {
  // Convert glob pattern to RegExp
  const regexPattern = pattern.replace(/\./g, "\\.").replace(/\*/g, ".*");

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(string);
}

export {
  printTree,
  simpleTreePrint,
  exportTreeToFile,
  exportFileContentsToFile,
  generateDirectorySummary,
};
