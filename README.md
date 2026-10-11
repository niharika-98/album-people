# Album People

**[Open the app](https://album-people.onrender.com/)** — paste a shared Google Photos album link to get started. Hosted on Render's free plan; the first visit after inactivity can take roughly a minute to wake up.

[Deployment instructions](DEPLOYMENT.md) · Deploy the UI and backend together using the included `render.yaml`.

Experimental local web app: shared Google Photos link → face groups → photos containing a selected person.

Run `node server.cjs` from this directory, then open http://localhost:3000.
No package installation or Google credentials required. Internet access is required for Google photos, face-api.js, and its model weights.

## Export to a new Google Photos album

## Google Drive without a client ID

Select a person, choose **Upload to Google Drive**, download the selected-photo ZIP, then open Drive using the dialog link. In Drive use New → File upload for the ZIP, or extract it and use Folder upload to share individual photos. Upload is manual through Google's website; the app never requests a Drive token or uses a client ID for this flow. ZIP preparation includes exactly the currently selected photos and fails without saving a partial archive if a download fails. Exports contain the app's up-to-1600-pixel copies and are capped at 128 MB to limit browser memory. There is no charge from this local app; Drive uploads consume your existing Google storage, with 15 GB included for personal accounts and optional paid storage upgrades.

### Reuse existing photos without an upload

Select a person, then **Use existing photos — no upload**. The app opens a handoff panel containing the original album, individual matching photo links, and optional Tampermonkey / Google Photos Toolkit installation links. You can copy the matching links or save a JSON selection list (URLs and photo IDs only). In your signed-in Google Photos browser, select existing photos and use Add to album → New album, then Share → Create link. For photos shared by someone else, Google may require saving them to your library first; this may affect your storage.

Google Photos Toolkit is a third-party userscript with an Add to new album action and undocumented Google web API calls. Its documented interface does not import the app's arbitrary person selection. This handoff does not automatically select photos or create an album; a custom extension bridge would need separate development and testing. The app does not install extensions. Original shared-photo links retain the source album's access permissions and do not isolate the selected subset.

### Upload copies using Google sign-in

Select a person (or All photos), then click **Export as new Google Photos album**. Export uploads copies of the selected photos and returns the new album's private Google Photos link. Google removed API album sharing, so open the resulting album and use **Share → Create link** to get a publicly shareable URL. Downloaded shared-photo copies may differ from originals.

Google sign-in requires a one-time developer setup:

1. Create a Google Cloud project and enable the **Photos Library API**.
2. Configure the OAuth consent screen, include the `https://www.googleapis.com/auth/photoslibrary.appendonly` scope, and add your Google account as a test user while in testing mode.
3. Create an OAuth client of type **Web application**. Add `http://localhost:3000` to **Authorized JavaScript origins** (also add `http://127.0.0.1:3000` if you use that address).
4. In PowerShell, set `$env:GOOGLE_CLIENT_ID = 'your-client-id.apps.googleusercontent.com'`, then start `node server.cjs`. A client secret is not used.

Access tokens stay in memory and are never written to disk or logs. Exports run on the local server and progress is available for 30 minutes after completion. Maximum 500 photos per export. If an export fails, any created album and already added photos remain in Google Photos; open the returned link to review before retrying, which creates another album. Uploaded bytes not yet created as media items may not appear in the album. Sign-in/account uploads cannot be verified until a real OAuth client is configured.

The server binds only to your computer by default; the hosted configuration binds to the platform's web interface. Photos pass through the app server; face descriptors and face crops remain in browser memory and disappear on reload. Google and model/CDN hosts receive the necessary download requests. Nothing is uploaded to an external face-recognition service. The app does not infer names.

## Current limits

- Only albums viewable without Google sign-in are supported.
- Imports use undocumented Google page data. Google changes may break parsing.
- Pagination is not implemented. The interface flags incomplete imports rather than claiming the whole album was retrieved.
- Images are downloaded at up to 1600 pixels for matching; originals are not exported. Video frames are not analyzed.
- Similar-face groups are estimates, not guaranteed identities. Average-linkage clustering compares faces across the album, with a maximum-distance guard against weak chains and a rule keeping different faces in one photograph apart. The default threshold is 0.56. Sensitivity can regroup faces. Select a person to manually merge duplicate groups; corrections last until reload, reimport, or rescan. Manual split is not implemented.
- SSD face detection, landmarks, and embeddings run in the browser with face-api.js 0.22.2. Large albums may take several minutes.
- Public deployment uses the included hosting configuration and isolated visitor sessions. See DEPLOYMENT.md for capacity, session expiry, and free-host limitations.

## Verification

The supplied test album returned 190 photo records, its reported count was 190, and its pagination token was empty. Browser verification scanned all 190 photos with zero analysis failures, detecting 371 faces in 59 estimated groups at sensitivity 0.48. Selecting Person 1 filtered the gallery to 41 photos. These counts verify the workflow, not identity accuracy; groups may contain duplicates or incorrect matches. Importer tests cover URL restrictions, parsing, incomplete imports, and private-page rejection.

After the matching revision, the same album scan detected 371 faces in 22 estimated groups at 0.56, with zero photo-analysis failures. Person 1 filtered to 60 photos. Attempting to merge two groups that contain different faces in the same photo was rejected. Clustering regression tests cover pose variation, reversed input order, distinct identities, co-occurrence, manual corrections, and limits on weak matching chains. These checks show reduced fragmentation; the album has no labeled identity ground truth, so they do not establish a measured recognition accuracy.
