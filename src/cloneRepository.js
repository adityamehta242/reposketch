import shell from "shelljs";
import fs from "fs";
import path from "path";
import url from "url";

/**
 * Clone a git repository into a "Repository" folder, automatically deleting existing repository if needed
 * @param {string} repoURL - URL of the git repository to clone
 * @returns {Object} Result of the operation containing success status and message
 */
function CloneRepository(repoURL) {
  try {
    // Input URL validation
    if (!repoURL || typeof repoURL !== "string") {
      return {
        success: false,
        message: "Invalid repository URL"
      };
    }

    // Validate if the URL is likely a valid Git repository URL
    let isValidLink = isLikelyValidGitRepoURL(repoURL);
    if (!isValidLink) {
      return {
        success: false,
        message: "URL might not be a valid Git repository URL."
      };
    }

    // Check if git is installed
    if (!shell.which("git")) {
      return {
        success: false,
        message: "Git is not installed on this system"
      };
    }

    // Extract the repository name from the URL to use as folder name
    const repoName = extractRepoName(repoURL);
    if (!repoName) {
      return {
        success: false,
        message: "Could not extract repository name from URL"
      };
    }

    // Create a "Repository" folder if it doesn't exist
    const repositoryFolder = path.resolve("Repository");
    if (!fs.existsSync(repositoryFolder)) {
      fs.mkdirSync(repositoryFolder, { recursive: true });
      console.log(`Created main Repository folder at ${repositoryFolder}`);
    }

    // Path where the repository will be cloned (inside the Repository folder)
    const targetPath = path.join(repositoryFolder, repoName);

    // Check if the repository folder already exists and delete it if it does
    if (fs.existsSync(targetPath)) {
      console.log(`Repository folder ${targetPath} already exists. Deleting...`);
      shell.rm("-rf", targetPath);
    }

    // Prepare clone command - clone into the specific target path inside Repository folder
    const cloneCommand = `git clone ${repoURL} ${targetPath}`;

    // Execute clone command
    console.log(`Cloning repository from ${repoURL}...`);
    const result = shell.exec(cloneCommand, { silent: false });

    // Check result
    if (result.code !== 0) {
      return {
        success: false,
        message: `Failed to clone repository: ${result.stderr}`,
        error: result.stderr
      };
    }

    return {
      success: true,
      message: `Repository cloned successfully to ${targetPath}`,
      targetPath
    };
  } catch (error) {
    return {
      success: false,
      message: `An error occurred: ${error.message}`,
      error
    };
  }
}

/**
 * Validates if a URL is likely a valid Git repository URL
 * @param {string} repoURL - URL to validate
 * @returns {boolean} True if the URL looks like a valid Git repo URL, false otherwise
 */
function isLikelyValidGitRepoURL(repoURL) {
  if (!repoURL || typeof repoURL !== "string") {
    console.warn("Invalid input: repoURL must be a non-empty string.");
    return false;
  }

  repoURL = repoURL.trim();
  
  // Common patterns for Git URLs (HTTPS and SSH)
  const gitUrlPattern = /^(https:\/\/|git@)[\w.-]+(:|\/)[\w./-]+(\.git)?$/;
  
  // Known hosts for public Git services
  const knownGitHosts = ["github.com", "gitlab.com", "bitbucket.org"];
  
  // Check if URL matches Git pattern
  const matchesPattern = gitUrlPattern.test(repoURL);
  
  // Check if URL includes any known Git host
  const includesKnownHost = knownGitHosts.some((host) => repoURL.includes(host));
  
  if (!matchesPattern && !includesKnownHost) {
    console.warn("Warning: URL might not be a valid Git repository URL.");
    return false;
  }
  
  return true;
}

/**
 * Extract repository name from Git URL
 * @param {string} repoURL - Git repository URL
 * @returns {string|null} Repository name or null if couldn't extract
 */
function extractRepoName(repoURL) {
  try {

    // Handle different URL formats
    if (repoURL.startsWith("https://")) {

      // For HTTPS URLs like https://github.com/username/repo-name
      const pathParts = new URL(repoURL).pathname.split('/').filter(Boolean);
      const repoName = pathParts[pathParts.length - 1].replace(".git", "");
      return repoName;
    } else if (repoURL.startsWith("git@")) {
        
      // For SSH URLs like git@github.com:username/repo-name.git
      const match = repoURL.match(/git@.*:(.+?)(?:\.git)?$/);
      if (match && match[1]) {
        const pathParts = match[1].split('/');
        return pathParts[pathParts.length - 1].replace(".git", "");
      }
    }
    
    // Default fallback to extract anything after the last slash
    const parts = repoURL.split("/");
    return parts[parts.length - 1].replace(".git", "");
  } catch (error) {
    console.error("Failed to extract repository name:", error);
    return null;
  }
}

export { CloneRepository };