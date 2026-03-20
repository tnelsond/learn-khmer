#!/bin/dash

pyftsubset $1 --unicodes=U+0000-007E,U+1780-17FF --output-file=$2 --flavor=woff
