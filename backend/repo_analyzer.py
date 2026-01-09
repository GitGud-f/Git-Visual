import os
import shutil
from git import Repo
from pydriller import Repository
from datetime import datetime

CACHE_DIR = "cache"

class GitAnalyzer:
    def __init__(self, repo_url):
        self.repo_url = repo_url
        self.repo_name = repo_url.split("/")[-1].replace(".git", "")
        self.local_path = os.path.join(CACHE_DIR, self.repo_name)

    def prepare_repo(self):
        """Clones if new, Pulls if exists"""
        if not os.path.exists(CACHE_DIR):
            os.makedirs(CACHE_DIR)

        if os.path.exists(self.local_path):
            print(f"Update: Pulling latest changes for {self.repo_name}...")
            repo = Repo(self.local_path)
            repo.remotes.origin.pull()
        else:
            print(f"Init: Cloning {self.repo_name}...")
            Repo.clone_from(self.repo_url, self.local_path)

    def get_file_structure(self):
        """
        Walks the directory to build a hierarchy for D3 Sunburst/Treemap.
        Calculates Lines of Code (LOC) for 'value'.
        """
        def path_to_dict(path):
            d = {'name': os.path.basename(path)}
            if os.path.isdir(path):
                # Filter out .git folder
                if d['name'] == ".git":
                    return None
                
                children = [path_to_dict(os.path.join(path, x)) for x in os.listdir(path)]
                # Filter out None values (like .git)
                d['children'] = [c for c in children if c is not None]
            else:
                # It's a file, calculate size/LOC
                try:
                    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                        d['value'] = sum(1 for _ in f) # Lines of Code
                except Exception:
                    d['value'] = 0 # Binary files or errors
            return d

        root_structure = path_to_dict(self.local_path)
        return root_structure

    def get_commit_history(self):
        """
        Extracts commit history for Streamgraph/Scatter plot.
        Limit: Last 2000 commits to keep frontend fast for the demo.
        """
        commits_data = []
        
        # Traverse commits using PyDriller
        # We assume 'master' or 'main' branch
        repo = Repository(self.local_path, order='reverse') 
        
        count = 0
        for commit in repo.traverse_commits():
            if count > 2000: break 
            
            commits_data.append({
                "hash": commit.hash,
                "msg": commit.msg,
                "author": commit.author.name,
                "date": commit.committer_date.isoformat(),
                "files_changed": len(commit.modified_files),
                "insertions": commit.insertions,
                "deletions": commit.deletions
            })
            count += 1
            
        return commits_data

    def analyze(self):
        self.prepare_repo()
        return {
            "file_tree": self.get_file_structure(),
            "history": self.get_commit_history()
        }