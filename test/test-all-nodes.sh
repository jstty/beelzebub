#!/bin/bash

TEST='mocha --check-leaks -t 5000 -b -R spec test/tests.js'

cd ..
npm run-script compile
echo "-----------------------------"

echo "Testing Node v0.10 ..."
sudo n 0.10
$TEST
echo "-----------------------------"

# # PASSED!
# echo "Testing Node v0.11 ..."
# sudo n 0.11
# $TEST
# echo "-----------------------------"

# # PASSED!
# echo "Testing Node v0.12 ..."
# sudo n 0.12
# $TEST
# echo "-----------------------------"

# # PASSED!
# echo "Testing Node v4.4 ..."
# sudo n 4.4
# $TEST
# echo "-----------------------------"

# # PASSED!
# echo "Testing Node v5.12 ..."
# sudo n 5.12
# $TEST
# echo "-----------------------------"

# # !!! Error: AssertionError: expected 'MyTasks task1: after' to equal 'MyTasks task2: yield delay 200'
# echo "Testing Node v6.3 ..."
# sudo n 6.3
# $TEST
