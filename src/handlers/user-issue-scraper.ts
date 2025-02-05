import { issueScraper } from "./issue-scraper";
import fs from "fs";
import path from "path";

interface UserMetadata {
  raw_user_meta_data: {
    user_name: string;
  };
}

export async function userIssueScraper(fileDir: string): Promise<void> {
  try {
    // Read auth.users.json
    const authUsersPath = path.join(fileDir, "auth.users.json");
    const authUsersData = fs.readFileSync(authUsersPath, "utf-8");
    const users = JSON.parse(authUsersData) as UserMetadata[];

    console.log("Processing issues for all users");
    for (const user of users) {
      const username = user.raw_user_meta_data.user_name;
      if (!username) {
        console.error("Username not found in user metadata");
        continue;
      }

      console.log(`Processing issues for user: ${username}`);
      try {
        const result = await issueScraper(username);
        console.log(result);
      } catch (error) {
        console.error(`Error processing user ${username}:`, error);
      }
    }
  } catch (error) {
    console.error("Error in userIssueScraper:", error);
    throw error;
  }
}

// Run the scraper
userIssueScraper(process.cwd())
  .then(() => console.log("Completed processing all users"))
  .catch((error) => {
    console.error("Error running user issue scraper:", error);
    process.exit(1);
  });
