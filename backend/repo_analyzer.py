"""
Module to analyze Git repositories: clone/pull, extract file structure and commit history.
"""

import os
import shutil
from typing import Dict, List, Any, Optional
from git import Repo, GitCommandError
from pydriller import Repository
from datetime import datetime

CACHE_DIR = "cache"

IGNORED_FOLDERS = {
    '.git', '.idea', '.vscode', '__pycache__', 'node_modules', 
    'venv', 'env', 'dist', 'build', 'coverage'
}

class GitAnalyzer:
    """
    A utility class to manage Git repositories and extract data for visualization.
    Features:
        1. Clones the repo if not present, else pulls latest changes.
        2. Builds a hierarchical file structure with LOC for visualization.
        3. Extracts commit history for analysis.
    """
    def __init__(self, repo_url: str, history_limit: int = 2000):
        """
        Initialize the analyzer.

        Args:
            repo_url (str): The HTTPS URL of the GitHub repository.
            history_limit (int): Max number of commits to fetch (default: 2000).
        """
        self.repo_url = repo_url
        self.repo_name = repo_url.split("/")[-1].replace(".git", "")
        self.local_path = os.path.join(CACHE_DIR, self.repo_name)
        self.history_limit = history_limit

    def prepare_repo(self) -> None:
        """
        Clones the repository if it does not exist locally.
        If it exists, performs a 'git pull' to fetch the latest changes.
        
        Raises:
            Exception: If network connectivity fails or the URL is invalid.
        """

        if not os.path.exists(CACHE_DIR):
            os.makedirs(CACHE_DIR)

        if os.path.exists(self.local_path):
            try:
                print(f"[{self.repo_name}] Updating: Pulling latest changes...")
                repo = Repo(self.local_path)
                repo.remotes.origin.pull()
            except GitCommandError as e:
                print(f"Error pulling repo: {e}")
                shutil.rmtree(self.local_path)
                Repo.clone_from(self.repo_url, self.local_path)
        else:
            print(f"Init: Cloning {self.repo_name}...")
            Repo.clone_from(self.repo_url, self.local_path)

    def get_file_structure(self) -> Dict[str, Any]:
        """
        Recursively walks the directory to build a hierarchy suitable for 
        d3.hierarchy() and Sunburst charts.

        Structure format:
        {
            "name": "folder_name",
            "children": [ ... ],
            "value": 150 (Lines of Code, only for files),
            "extension": ".py" (only for files)
        }

        Returns:
            Dict[str, Any]: The root node of the file tree.
        """
        def path_to_dict(path: str) -> Optional[Dict[str, Any]]:
            """
            Recursively builds a dict representing file structure.
            Args:
                path (str): Current file/directory path.
            Returns:
                dict: Hierarchical representation of files/directories, None for .git
            """
            
            name = os.path.basename(path)
            
            if name in IGNORED_FOLDERS:
                return None

            d = {'name': name}
            
            if os.path.isdir(path):

                children = [path_to_dict(os.path.join(path, x)) for x in os.listdir(path)]
                # Filter out None values (like .git)
                d['children'] = [c for c in children if c is not None]
                d['type'] = 'folder'
            else:
                try:
                    with open(path, 'r', encoding='utf-8', errors='replace') as f:
                        d['value'] = sum(1 for _ in f) 
                        
                    _, ext = os.path.splitext(name)
                    d['extension'] = ext.lower()
                    d['type'] = 'file'
                    
                except Exception:
                    d['value'] = 0 
                    d['type'] = 'binary'
            return d
        
        print(f"[{self.repo_name}] Analyzing file structure...")
        root_structure = path_to_dict(self.local_path)
        
        if root_structure:
            root_structure['name'] = self.repo_name
            
        return root_structure

    def get_commit_history(self) -> List[Dict[str, Any]]:
        """
        Extracts commit metadata using PyDriller.
        Traverses in reverse order (newest first) to get the most relevant recent data.

        Returns:
            List[Dict[str, Any]]: A list of commit objects containing author, date, and stats.
        """
        commits_data = []
        
        print(f"[{self.repo_name}] Mining commit history (Limit: {self.history_limit})...")
        
        repo = Repository(self.local_path, order='reverse') 
        
        count = 0
        for commit in repo.traverse_commits():
            if count > self.history_limit: 
                break
            
            commits_data.append({
                "hash": commit.hash,
                "msg": commit.msg.split('\n')[0],
                "author": commit.author.name,
                "date": commit.committer_date.isoformat(),
                "files_changed": len(commit.modified_files),
                "impact": commit.insertions + commit.deletions,
                "insertions": commit.insertions,
                "deletions": commit.deletions
            })
            count += 1
            
        return commits_data

    def analyze(self) -> Dict[str, Any]:
        """
        Orchestrates the analysis process.

        Returns:
            Dict[str, Any]: The complete payload for the D3 Frontend.
        """
        self.prepare_repo()
        return {
            "meta": {
                "repo_name": self.repo_name,
                "analyzed_at": datetime.now().isoformat()
            },
            "file_tree": self.get_file_structure(),
            "history": self.get_commit_history()
        }