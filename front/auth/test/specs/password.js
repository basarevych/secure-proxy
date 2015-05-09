'use strict'

describe("Password functions", function () {
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

    it("check and focus empty fields", function () {
        submitPassword();
        expect($('#login')).toBeFocused();

        $('#login').val('foobar');
        submitPassword();
        expect($('#password')).toBeFocused();
    });

    it("handle invalid credentials", function () {
        spyOn($, 'ajax').and.callFake(function (params) {
            params.success({ success: false });
        });

        $('#login').val('foo');
        $('#password').val('bar');
        submitPassword();

        expect($.ajax).toHaveBeenCalled();
        expect($('#login-messages')).toContainHtml('INVALID_LOGIN');
    });

    it("work when next step is 'otp' with QR code", function () {
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
    });
});
