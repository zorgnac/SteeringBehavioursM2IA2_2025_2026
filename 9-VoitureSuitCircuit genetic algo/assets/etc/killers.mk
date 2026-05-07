allKillers.json	: etc/merge.js
allKillers.json	: $(wildcard killerTracks/*.json)
	etc/merge.js --output=$@ killerTracks/*.json

