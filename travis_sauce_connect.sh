#!/bin/bash

mkdir -p /tmp/sauce_connect
cd /tmp/sauce_connect

echo "Downloading Sauce Connect"

SC_NAME=sc-4.4.2-linux

wget "https://saucelabs.com/downloads/${SC_NAME}.tar.gz"

echo "Extracting Sauce Connect"
tar -zxf "${SC_NAME}.tar.gz"

SC_READYFILE=sauce-connect-ready-$RANDOM

echo "Starting Sauce Connect"
./${SC_NAME}/bin/sc \
  -i ${TRAVIS_JOB_NUMBER} \
  -f ${SC_READYFILE} \
  -l $HOME/sauce-connect.log &

echo "Waiting for Sauce Connect readyfile"
while [ ! -f ${SC_READYFILE} ]; do
  sleep .5
done
