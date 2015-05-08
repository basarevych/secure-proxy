WORK IN PROGRESS
================


Installation
------------

```sh
# cd /usr/local
# git clone https://github.com/basarevych/secure-proxy
# cd secure-proxy
# ./scripts/install
# ./scripts/build

Create and edit config.js:
# cp config.js.dist config.js

Add users:
# node src/index.js update-user

Replace www with your user (specified in config.js):
# chown -R www:www data
```

FreeBSD
-------

```sh
# cd /usr/local/etc/rc.d
# ln -s /usr/local/secure-proxy/scripts/freebsd-rc.d/secure-proxy
```

Add to /etc/rc.conf:
```
secure_proxy_enable="YES"
secure_proxy_path="/usr/locale/secure-proxy"
```

Run secure-proxy:
```
# service secure-proxy start
```
