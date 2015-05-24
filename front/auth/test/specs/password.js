'use strict'

describe("Password", function () {
    beforeEach(function (done) {
        $.ajax({
            url: 'html/index.html',
            dataType: 'html',
            success: function (html) {
                var fixture = $('<div id="fixture"></div>');
                $('body').append(fixture.append(html));
                done();
            }
        });

        var gl = {
            formatMessage: function (msg) { return msg; }
        };
        window['globalize'] = gl;
        spyOn(gl, 'formatMessage').and.callThrough();
    });

    afterEach(function () {
        $('#fixture').remove();
    });

    describe("Submit", function () {
        it("checks and focus empty fields", function () {
            submitPassword();
            expect($('#login')).toBeFocused();

            $('#login').val('foobar');
            submitPassword();
            expect($('#password')).toBeFocused();
        });

        it("does correct ajax requests", function () {
            var counter = 0;
            spyOn($, 'ajax').and.callFake(function (params) {
                switch (++counter) {
                    case 1:
                        params.success({ success: true, next: 'otp' });
                        expect(params.url).toBe('/secure-proxy/api/auth');
                        expect(params.data.action).toBe('check');
                        break;
                    case 2:
                        params.success({ success: true, qr_code: 'foobar' });
                        expect(params.url).toBe('/secure-proxy/api/otp');
                        expect(params.data.action).toBe('get');
                        break;
                }
            });

            $('#login').val('foo');
            $('#password').val('bar');
            submitPassword();
        });

        it("handles invalid credentials", function () {
            spyOn($, 'ajax').and.callFake(function (params) {
                params.success({ success: false });
            });

            $('#login').val('foo');
            $('#password').val('bar');
            submitPassword();

            expect($.ajax).toHaveBeenCalled();
            expect($('#login-messages')).toContainHtml('INVALID_LOGIN');
        });

        it("reboots if done", function (done) {
            spyOn($, 'ajax').and.callFake(function (params) {
                params.success({ success: true, reload: true });
            });

            spyOn($.fn, 'slideUp').and.callFake(function (callback) {
                callback();

                expect($.ajax).toHaveBeenCalled();
                expect(window.location.reload).toHaveBeenCalled();

                done();
            });

            spyOn(window.location, 'reload');

            $('#login').val('foo');
            $('#password').val('bar');
            submitPassword();
        });
    });

    describe("Request OTP data", function () {
        it("handles generic response", function (done) {
            var counter = 0;
            spyOn($, 'ajax').and.callFake(function (params) {
                switch (++counter) {
                    case 1:
                        params.success({ success: true, next: 'otp' });
                        break;
                    case 2:
                        params.success({ success: true, qr_code: 'foobar' });
                        break;
                }
            });

            $('#login').val('foo');
            $('#password').val('bar');
            submitPassword();

            setTimeout(function () {
                expect($('#login')).toHaveProp('disabled', true);
                expect($('#password')).toHaveProp('disabled', true);
                expect($('#submit-password-button')).not.toBeVisible();
                expect($('#reset-password-button')).not.toBeVisible();
                expect($('#otp')).toBeFocused();

                done();
            }, 1000);
        });

        it("displays qr code", function () {
            var counter = 0;
            spyOn($, 'ajax').and.callFake(function (params) {
                switch (++counter) {
                    case 1:
                        params.success({ success: true, next: 'otp' });
                        break;
                    case 2:
                        params.success({ success: true, qr_code: 'foobar' });
                        break;
                }
            });

            var qrParams;
            spyOn($.fn, 'qrcode').and.callFake(function (params) {
                qrParams = params;
            });

            $('#login').val('foo');
            $('#password').val('bar');
            submitPassword();

            expect($.fn.qrcode).toHaveBeenCalled();
            expect(qrParams.text).toBe('foobar');

            expect($('#qr-show-group')).not.toHaveCss({ display: 'none' });
            expect($('#reset-otp-button')).toHaveCss({ display: 'none' });
        });

        it("hides qr code", function () {
            var counter = 0;
            spyOn($, 'ajax').and.callFake(function (params) {
                switch (++counter) {
                    case 1:
                        params.success({ success: true, next: 'otp' });
                        break;
                    case 2:
                        params.success({ success: true });
                        break;
                }
            });

            spyOn($.fn, 'qrcode');

            $('#login').val('foo');
            $('#password').val('bar');
            submitPassword();

            expect($.fn.qrcode).not.toHaveBeenCalled();

            expect($('#qr-show-group')).toHaveCss({ display: 'none' });
            expect($('#reset-otp-button')).not.toHaveCss({ display: 'none' });
        });

        it("reboots when requested", function () {
            var counter = 0;
            spyOn($, 'ajax').and.callFake(function (params) {
                switch (++counter) {
                    case 1:
                        params.success({ success: true });
                        break;
                    case 2:
                        params.success({ success: false, reload: true });
                        break;
                }
            });

            spyOn(window.location, 'reload');

            $('#login').val('foo');
            $('#password').val('bar');
            submitPassword();

            expect(window.location.reload).toHaveBeenCalled();
        });
    });

    describe("Reset request", function () {
        it("checks and focus empty fields", function () {
            resetPassword();
            $('#modal-submit').trigger('click');
            expect($('#email')).toBeFocused();
        });

        it("does correct ajax request", function () {
            spyOn($, 'ajax').and.callFake(function (params) {
                params.success({ success: true });
                expect(params.url).toBe('/secure-proxy/api/reset-request');
                expect(params.data.type).toBe('password');
            });

            resetPassword();
            $('#email').val('foobar');
            $('#modal-submit').trigger('click');
        });

        it("handles success", function () {
            spyOn($, 'ajax').and.callFake(function (params) {
                params.success({ success: true });
            });

            resetPassword();
            $('#email').val('foobar');
            $('#modal-submit').trigger('click');

            expect($('#reset-messages')).toHaveText('EMAIL_SENT');
        });

        it("handles external password", function () {
            spyOn($, 'ajax').and.callFake(function (params) {
                params.success({ success: false, reason: 'external-password' });
            });

            resetPassword();
            $('#email').val('foobar');
            $('#modal-submit').trigger('click');

            expect($('#reset-messages')).toHaveText('EXTERN_PASSWORD');
        });

        it("handles invalid email", function () {
            spyOn($, 'ajax').and.callFake(function (params) {
                params.success({ success: false });
            });

            resetPassword();
            $('#email').val('foobar');
            $('#modal-submit').trigger('click');

            expect($('#reset-messages')).toHaveText('INVALID_EMAIL');
        });
    });
});
