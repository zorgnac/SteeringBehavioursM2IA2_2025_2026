.ONESHELL	: 1
SHELL	= /bin/bash
BROWSER_DOWNLOAD	?= ${HOME}/var/download/

P	= mb-
SRC	= ${BROWSER_DOWNLOAD}

ALL.mb	= $(wildcard ${SRC}$P*)
ALL.tracks	=  $(wildcard ${SRC}$P*tr*k*)
ALL	= ${ALL.mb:${SRC}$P%=%}
ALL.rm	= ${ALL:%=%.rm}
ALL.ls	= ${ALL:%=%.ls}

.PHONY	: tmp all 1
.PHONY	: echo ls rm

tmp	:
	mkdir -p $@
	cd $@
	make --no-print-directory -f ../Makefile all ROOT=../
all	:
	@for f in ${SRC}$P*
	do
	  [ -f "$$f" ] && {
	     mv "$$f" "$${f##*$P}"
	     echo "$${f##*$P}"
	  }
	done
	:

%.json	: ${SRC}$P%.json
	@mv "$<" "$@" && echo $@

gen%	: ${SRC}$Pgen%.json
	@mv "$<" "$@.json" && echo $@.json
car%	: ${SRC}$Pcar%.json
	@mv "$<" "$@.json" && echo $@.json
track%	: ${SRC}$Ptrack%.json
	@mv "$<" "$@.json" && echo $@.json

$P%.json	: ${SRC}$P%.json
	@mv "$<" "$*.json" && echo $*.json

%.txt	: ${SRC}$P%.txt
	@mv "$<" "$@" && echo $@

$P%.txt	: ${SRC}$P%.txt
	@mv "$<" "$*.txt" && echo $*.txt

ls	: 
	@cd ${SRC} && ls -lrht $P* 2> /dev/null || :
%.ls	:
	@cd ${SRC} && ls -l "$P$*"

echo	: 
	@echo ${SRC}
ls	: echo

rm	: ls
rm	:
	@cd ${SRC} && rm $P*
