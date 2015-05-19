'use strict'

describe("OTP", function () {
    beforeEach(function (done) {
        $.ajax({
            url: 'html/index.html',
            dataType: 'html',
            success: function (html) {
                var fixture = $('<div id="fixture"></div>');
                $('body').append(fixture.append(html));
                $('#otp-section').show();
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
            submitOtp();
            expect($('#otp')).toBeFocused();
        });

        it("does correct ajax requests", function () {
            spyOn($, 'ajax').and.callFake(function (params) {
                params.success({ success: false });
                expect(params.url).toBe('/secure-proxy/api/otp');
                expect(params.data.action).toBe('check');
            });

            $('#otp').val('foo');
            submitOtp();
        });

        it("handles invalid credentials", function () {
            spyOn($, 'ajax').and.callFake(function (params) {
                params.success({ success: false });
            });

            $('#otp').val('foo');
            submitOtp();

            expect($.ajax).toHaveBeenCalled();
            expect($('#otp-messages')).toContainHtml('INVALID_OTP');
        });

        it("reboots when requested", function () {
            spyOn($, 'ajax').and.callFake(function (params) {
                params.success({ success: false, reload: true });
            });

            spyOn(window.location, 'reload');

            $('#otp').val('foo');
            submitOtp();

            expect(window.location.reload).toHaveBeenCalled();
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

            $('#otp').val('bar');
            submitOtp();
        });
    });

    describe("Reset request", function () {
        it("checks and focus empty fields", function () {
            resetOtp();
            $('#modal-submit').trigger('click');
            expect($('#email')).toBeFocused();
        });

        it("does correct ajax request", function () {
            spyOn($, 'ajax').and.callFake(function (params) {
                params.success({ success: true });
                expect(params.url).toBe('/secure-proxy/api/reset-request');
                expect(params.data.type).toBe('otp');
            });

            resetOtp();
            $('#email').val('foobar');
            $('#modal-submit').trigger('click');
        });

        it("handles success", function () {
            spyOn($, 'ajax').and.callFake(function (params) {
                params.success({ success: true });
            });

            resetOtp();
            $('#email').val('foobar');
            $('#modal-submit').trigger('click');

            expect($('#reset-messages')).toHaveText('EMAIL_SENT');
        });

        it("handles invalid email", function () {
            spyOn($, 'ajax').and.callFake(function (params) {
                params.success({ success: false });
            });

            resetOtp();
            $('#email').val('foobar');
            $('#modal-submit').trigger('click');

            expect($('#reset-messages')).toHaveText('INVALID_EMAIL');
        });
    });
});
