#!/bin/bash

if [ "$SAUCE_USERNAME" == "" ] ||
   [ "$SAUCE_ACCESS_KEY" == "" ] ||
   [ "$SAUCE_TUNNEL_ID" == "" ] ; then
  echo "Missing SAUCE_USERNAME or SAUCE_ACCESS_KEY or SAUCE_TUNNEL_ID."
  echo "Not starting sauce connect."
  exit 0 ;
fi

mkdir -p /tmp/sauce_connect
cd /tmp/sauce_connect

echo "Downloading Sauce Connect"

SC_NAME=sc-4.6.2-linux

wget "https://saucelabs.com/downloads/${SC_NAME}.tar.gz"

echo "Extracting Sauce Connect"
tar -zxf "${SC_NAME}.tar.gz"

SC_READYFILE=sauce-connect-ready-$RANDOM

echo "Starting Sauce Connect"
./${SC_NAME}/bin/sc \
  -i ${SAUCE_TUNNEL_ID} \
  -f ${SC_READYFILE} \
  -l $HOME/sauce-connect.log &

echo "Waiting for Sauce Connect readyfile"
while [ ! -f ${SC_READYFILE} ]; do
  sleep .5
done
