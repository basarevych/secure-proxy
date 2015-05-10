'use strict'

describe("Password reset", function () {
    beforeEach(function (done) {
        $.ajax({
            url: 'html/reset-password.html',
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
        it("checks and focus empty fields", function () {
            doResetPassword();
            expect($('#newpassword1')).toBeFocused();

            $('#newpassword1').val('foobar');
            doResetPassword();
            expect($('#newpassword2')).toBeFocused();
        });

        it("checks if passwords match", function () {
            $('#newpassword1').val('foo');
            $('#newpassword2').val('bar');
            doResetPassword();

            expect($('#password-messages')).toContainText('PASSWORDS_DO_NOT_MATCH');
        });

        it("does correct ajax requests", function () {
            spyOn($, 'ajax').and.callFake(function (params) {
                params.success({ success: true });
                expect(params.url).toBe('/secure-proxy/api/auth');
                expect(params.data.action).toBe('set');
                expect(params.data.secret).toBe('foobar');
            });

            $('#newpassword1').val('foo');
            $('#newpassword2').val('foo');
            doResetPassword();
        });

        it("handles unknown error", function () {
            spyOn($, 'ajax').and.callFake(function (params) {
                params.success({ success: false });
            });

            $('#newpassword1').val('foo');
            $('#newpassword2').val('foo');
            doResetPassword();

            expect($.ajax).toHaveBeenCalled();
            expect($('#password-messages')).toContainHtml('PASSWORD_RESET_FAILURE');
        });

        it("handles expired error", function () {
            spyOn($, 'ajax').and.callFake(function (params) {
                params.success({ success: false, reason: 'expired' });
            });

            $('#newpassword1').val('foo');
            $('#newpassword2').val('foo');
            doResetPassword();

            expect($.ajax).toHaveBeenCalled();
            expect($('#password-messages')).toContainHtml('PAGE_EXPIRED');
        });

        it("handles success", function () {
            spyOn($, 'ajax').and.callFake(function (params) {
                params.success({ success: true });
            });

            $('#newpassword1').val('foo');
            $('#newpassword2').val('foo');
            doResetPassword();

            expect($.ajax).toHaveBeenCalled();
            expect($('#password-messages')).toContainHtml('PASSWORD_RESET_SUCCESS');
        });
    });
});
