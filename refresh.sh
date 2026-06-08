#!/bin/sh

# Refresh the app image, rebuild the stack, and restart it.

ssh pancho-pi 'cd /var/www/services/dmaga && make update'
