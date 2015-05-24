WORK IN PROGRESS
================

Secure Proxy
============

HTTP/HTTPS reverse proxy which adds login/password and Google Authenticator protection to the target site.

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

Replace www with your user (the same as in config.js):
> chown -R www data
> chmod -R ug+w data

> cd ..
> sudo mv secure-proxy /usr/local/
```

**FreeBSD**

```sh
# cd /usr/local/etc/rc.d
# cp /usr/local/secure-proxy/scripts/freebsd-rc.d/secure-proxy ./
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

```sh
# cd /etc/systemd/system
# cp /usr/local/secure-proxy/scripts/linux-systemd/secure-proxy.service ./

# systemctl daemon-reload
# systemctl enable secure-proxy
# systemctl start secure-proxy
```

Console Usage
-------------

Run it without parameters to get the list of commands:

```
> cd secure-proxy
> node src/index.js
```

Basically all you need to do is to add users ('create-user' command).

Active directory users (LDAP)
-----------------------------

You do not need to create LDAP users by hand (with 'create-user'). LDAP users will be
created on the fly when they successfully authenticate themselves.

Config
======

* **target**

  The server we will be proxying requests for

* **namespace**

  Cookie prefix

* **user** and **group**

  Secure proxy will drop priviliges to this user and group (if ran by root).

* **http**:

  ```js
  {
    enable: true,
    host: 'example.com',
    port: 80,
    base_url: 'http://example.com',
  }
  ```

  Enable/Disable HTTP proxy on the given host:port. 

  **host** is a DNS name or an IP address.

  **base_url** is used to construct password reset email links.

* **https**:

  ```
  {
    enable: false,
    host: 'example.com',
    port: 443,
    base_url: 'https://example.com',
    key: '/etc/certs/server.unencrypted.key',
    cert: '/etc/certs/server.crt',
  }
  ```

  Enable/Disable HTTPS proxy on the given host:port.

  **host** is a DNS name or an IP address.

  **base_url** is used to construct password reset email links.

  **key** and **cert** should point to your OpenSSL key and certificate files.

* **session**:

  ```js
  {
    lifetime: 24 * 60 * 60,
    gc_probabilty: 15,
    ip_protection: false,
  }
  ```

  **lifetime** is the period of inactivity (seconds) after which the session will be deleted

  **gc_probabilty** is the chance (0 - 100%) of running session garbage collector

  **ip_protection** flag enables source IP address check (the session will not work if IP
  address changes).

* **otp**:

  ```js
  {
    enable: true,
    name: 'Secure Proxy',
  }
  ```

  Enable/Disable OTP (One Time Password) protection (Google Authenticator). **name** is the site
  name (as shown in Google Authenticator interface).

* **ldap**:

  ```js
  {
    enable: false,
    url: 'ldap://192.168.0.1',
    domain: 'HQ',
    users_group: 'ou=users, ou=company, dc=hq, dc=company, dc=local',
    email_attr_name: 'mail',
  }
  ```

  Enable/Disable LDAP users. For example, if user login is 'user' the proxy will try to
  authenticate 'user@HQ' user with the given password. If successful the access will be
  granted and the user will be created. Then the group
  'ou=users, ou=company, dc=hq, dc=company, dc=local' will be searched with 
  samaccountname == 'user' for 'mail' attribute which will be stored as user's email.

* **email**:

  ```js
  {
    host: '127.0.0.1',
    port: 25,
    ssl: false,
    from: 'www@localhost',
  }
  ```

  SMTP server (outgoing mail) parameters

Interaction with the proxy
==========================

If address of the proxy is http://example.com then URLs starting with http://example.com/secure-proxy/
will be reserved for the proxy itself.

* **Logging out**

  Navigate to **/secure-proxy/api/logout** to log out of the proxy

* **Authentication status**

  Send GET request to **/secure-proxy/api/status** with parameter **sid** equal to your session ID
  to get authentication status of the user.

  PHP example (put it on the site behind the proxy):

  ```php
  if (!isset($_COOKIE['secureproxysid']))
    die("No session ID");

  $sid = $_COOKIE['secureproxysid'];

  // Change the hostname below:
  $data = file_get_contents('http://example.com/secure-proxy/api/status?sid=' . $sid);

  $json = json_decode($data, true);

  echo "Authenticated: " . ($json['authenticated'] ? "TRUE" : "FALSE");
  if ($json['authenticated'])
    echo "<br>Logged in as: " . $json['login'];
  ```

* **Detection of expiration of the session**

  If session expires and user navigates to a new URL or refreshes the page they will be provided
  with the login screen again, this happens automatically, no action is required.

  But if the session expires and the user makes AJAX request to the server, the request will fail
  and the page will not work as expected. One need to detect this situation and reload the page
  if the session is expired (to be able to relogin).

  If the proxy wants the user to authenticate themselves it will return HTTP result code 418 instead
  of 200 "OK". You can check for this event in your frontend.

  If, for example, your page has the following jQuery code:

  ```js
    $.ajax({
      url: '/some/url/to/backend.php',
      data: {
        param: 'some data',
      },
      success: function (data) {
        // Do something with the data...
      },
    });
  ```

  You can enhance it like this:

  ```js
    $.ajax({
      url: '/some/url/to/backend.php',
      data: {
        param: 'some data',
      },
      success: function (data) {
        // Do something with the data...
      },
      statusCode: {
        418: function () {                  // Reload the page on HTTP 418
            window.location.reload();
        },
      },
    });
  ```
