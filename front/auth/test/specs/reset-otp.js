'use strict'

describe("OTP reset", function () {
    beforeEach(function (done) {
        $.ajax({
            url: 'html/reset-otp.html',
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

        window.location += '#foobar';
    });

    afterEach(function () {
        $('#fixture').remove();
    });

    describe("Submit", function () {
        it("does correct ajax requests", function () {
            spyOn($, 'ajax').and.callFake(function (params) {
                params.success({ success: true });
                expect(params.url).toBe('/secure-proxy/api/otp');
                expect(params.data.action).toBe('reset');
                expect(params.data.secret).toBe('foobar');
            });

            doResetOtp();
        });

        it("handles unknown error", function () {
            spyOn($, 'ajax').and.callFake(function (params) {
                params.success({ success: false });
            });

            doResetOtp();

            expect($.ajax).toHaveBeenCalled();
            expect($('#password-messages')).toContainHtml('CODE_RESET_FAILURE');
        });

        it("handles expired error", function () {
            spyOn($, 'ajax').and.callFake(function (params) {
                params.success({ success: false, reason: 'expired' });
            });

            doResetOtp();

            expect($.ajax).toHaveBeenCalled();
            expect($('#password-messages')).toContainHtml('PAGE_EXPIRED');
        });

        it("handles success", function () {
            spyOn($, 'ajax').and.callFake(function (params) {
                params.success({ success: true });
            });

            doResetOtp();

            expect($.ajax).toHaveBeenCalled();
            expect($('#password-messages')).toContainHtml('CODE_RESET_SUCCESS');
        });
    });
});
