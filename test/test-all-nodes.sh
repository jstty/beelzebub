#!/bin/bash

ALL_VERSIONS="4 5 6 7 8"
TEST='npm test'

# run function
run() {
	$1
	if [ $? -eq 0 ]; then
		echo "All OK!"
	else
		echo "================================================="
		break
	fi
}

# echo "================================================="
# echo "-- Building Code..."
# cd ..
# run "npm run compile"

for V in $ALL_VERSIONS; do
	echo "================================================="
	echo "-- Testing Node v${V} ..."
	
	echo "-------------------------------------------------"
	echo "- Swiching Node versions..."
	echo "-------------------------------------------------"
	run "nvm use v$V"
	
	echo "-------------------------------------------------"
	echo "- Running Tests..."
	echo "-------------------------------------------------"
	run "$TEST"
	
done
