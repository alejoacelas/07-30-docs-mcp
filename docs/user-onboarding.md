# Connect Google Docs Preview in Claude

You do not need a Google Cloud project or OAuth credentials. 80,000 Hours configures
those once for the organization.

Before you start, the connector owner must add your Workspace email to Google’s
Developer Preview tester list. Google registers both the shared Cloud project and
each participating email.

## Connect

1. Open [Claude → Customize → Connectors](https://claude.ai/customize/connectors).
2. Find **Google Docs Preview** and click **Connect**.
3. On the 80,000 Hours authorization page, click **Continue to Google**.
4. Choose your `@80000hours.org` account.
5. Confirm that Google requests only permission to see, edit, create and delete
   Google Docs documents, then click **Allow**.

The connector can now act as your Google account on Docs you can access. It does not
inherit the service owner’s files or permissions.

## Use it

Give Claude a Google Doc URL and name **Google Docs Preview** explicitly when the
task needs comments or suggested edits. Keep write-tool approval enabled.

Use the [verification prompt](testing.md) for a first test.

## Access boundary

The current OAuth scope covers every Google Doc your account can access. A test folder
helps organize pilot documents but does not restrict the token to that folder.

Do not use the connector for confidential documents until 80,000 Hours has moved the
host, encrypted grant store and secrets into approved organization accounts and
completed the production review.

## Disconnect

Disconnect the connector in Claude, then revoke the Google grant under
[Google Account connections](https://myaccount.google.com/connections). Disconnecting
Claude alone does not revoke Google’s refresh token.
