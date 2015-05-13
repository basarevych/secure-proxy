WORK IN PROGRESS
================

Secure Proxy
============

HTTP/HTTPS reverse proxy that adds login/password and Google Authenticator protection to the target site.

Installation
------------

Install as regular user:

```sh
> git clone https://github.com/basarevych/secure-proxy
> cd secure-proxy
> ./scripts/install
> ./scripts/build

Create and edit config.js:
> cp config.js.dist config.js

Add users:
> node src/index.js update-user

Replace www with your user (specified in config.js):
> chown -R www data
> chmod -R ug+w data

> cd ..
> sudo mv secure-proxy /usr/local/
```

**FreeBSD**

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

**Linux**

TODO: Write a systemd unit file

Usage
-----

Run it without parameters to get the list of commands:

```
> cd secure-proxy
> node src/index.js
```

Basically all you need to do is to add users ('update-user' command).

Active directory users (LDAP)
-----------------------------

You do not need to create LDAP users by hand (with 'update-user'). LDAP users will be
created on the fly when they successfully authenticate themselves.

Config
======

* **target**

  The server wi will be proxying requests

* **namespace**

  Cookie prefix

* **user** and **group**

  Secure proxy will drop priviliges to this user and group (if ran by root).

* **otp**: {
    enable: true,
    name: 'Secure Proxy',
  },

  Enable/Disable OTP (One Time Password) protection (Google Authenticator).

* **ldap**: {
    enable: false,
    url: 'ldap://192.168.0.1',
    domain: 'HQ',
    users_group: 'ou=users, ou=company, dc=hq, dc=company, dc=local',
    email_attr_name: 'mail',
  },

  Enable/Disable LDAP users. For example, if user login is 'user' the proxy will try to
  authenticate 'user@HQ' user with the given password. If successful it will then search
  'ou=users, ou=company, dc=hq, dc=company, dc=local' with sAMAccountName == 'user' and
  look for 'mail' attribute to get user email address. If all is OK the user is created
  in the local database and is granted access.

* **email**: {
    host: '127.0.0.1',
    port: 25,
    ssl: false,
    from: 'www@localhost',
  },

  SMTP server (outgoing mail) parameters

* **http**: {
    enable: true,
    host: 'example.com',
    port: 80,
    base_url: 'http://example.com',
  },

  Enable/Disable HTTP proxy on the given host:port. 

  **host** is a DNS name or an IP address.

  **base_url** is used to construct password reset email links.

* **https**: {
    enable: false,
    host: 'example.com',
    port: 443,
    base_url: 'https://example.com',
    key: '/etc/certs/server.unencrypted.key',
    cert: '/etc/certs/server.crt',
  },

  Enable/Disable HTTPS proxy on the given host:port.

  **host** is a DNS name or an IP address.

  **base_url** is used to construct password reset email links.

  **key** and **cert** should point to your OpenSSL key and certificate files.
