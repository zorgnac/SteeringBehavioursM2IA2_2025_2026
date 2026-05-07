.ONSHELL	: 1
.PHONY	: curves

curves	: \
	curves/h5x5c-s3.svg	\
	curves/behind.svg	\
	curves/h10c.svg	\
	curves/sym.svg	\

curves/h5x5c-s3.svg : etc/curve.awk
	sed -e "/## Résilience h5x5c-s3-f02/,/##/ b OK" -e d -e ":OK" LOG.md |
	awk -f etc/curve.awk > $@

curves/behind.svg	: etc/curve.awk
	sed -e "/## Option 'behind'/,/##/ b OK" -e d -e ":OK" LOG.md | 
	awk -f etc/curve.awk > $@

curves/h10c.svg	: etc/curve.awk
	sed -e "/## Option 'direct'.*h10,s1/,/##/ b OK" -e d -e ":OK" LOG.md | 
	awk -f etc/curve.awk > $@

curves/sym.svg	: etc/curve.awk
	sed -e "/## Symétrisation/,/##/ b OK" -e d -e ":OK" LOG.md | 
	awk -f etc/curve.awk > $@

curves/h2c2.svg : etc/curve.awk $F
	sed -e "/## Premières pistes h2c2/,/## Direction/ b OK" -e d -e ":OK" LOG.md | 
	awk -f etc/curve.awk > $@

