const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain';
try {
	const dirs = fs.readdirSync(brainDir).filter(f => {
		return fs.statSync(path.join(brainDir, f)).isDirectory() && f !== 'tempmediaStorage';
	});

	const historyList = [];

	for (const dir of dirs) {
		const overviewPath = path.join(brainDir, dir, '.system_generated', 'logs', 'overview.txt');
		if (fs.existsSync(overviewPath)) {
			try {
				const content = fs.readFileSync(overviewPath, 'utf8');
				// Find first user input
				const lines = content.split('\n');
				let firstRequest = '';
				let createdAt = '';
				for (const line of lines) {
					if (!line.trim()) continue;
					try {
						const data = JSON.parse(line);
						if (data.type === 'USER_INPUT') {
							const match = data.content.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
							firstRequest = match ? match[1].trim() : data.content.trim();
							createdAt = data.created_at;
							break;
						}
					} catch (e) {
						// ignore parse errors
					}
				}
				historyList.push({
					id: dir,
					createdAt: createdAt || fs.statSync(overviewPath).birthtime.toISOString(),
					firstRequest: firstRequest || '(No user request found)'
				});
			} catch (err) {
				// ignore file read errors
			}
		}
	}

	// Sort by creation date descending
	historyList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

	console.log(JSON.stringify(historyList, null, 2));
} catch (e) {
	console.error('Error listing directories:', e.message);
}
