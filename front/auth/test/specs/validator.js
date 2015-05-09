describe("Validator", function() {
    beforeEach(function (done) {
        $.ajax({
            url: 'test/fixtures/validator.html',
            dataType: 'html',
            success: function (html) {
                $('body').append(html);
                done();
            }
        });

        var globalize = {
            formatMessage: function () {}
        };
        window['globalize'] = globalize;
        spyOn(globalize, 'formatMessage');
    });

    it("checks for empty value", function() {
        validateFormField($('input[name=field]'));
        expect(globalize.formatMessage).toHaveBeenCalledWith('FIELD_EMPTY');
    });
});
