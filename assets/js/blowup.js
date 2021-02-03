$(document).ready(function() {

    $("blow").click(function() {
        if($(this).width() == "100") {
            $($(this).clone(true)).insertAfter(this);
            $(this).css({"position" : "fixed", "z-index" : "3"});
            $(this).animate({"width" : $(window).width()-32, "height" : $(window).height()-32, "top" : "0px"}, 1000);
        }
        else {
            $(this).animate({"width" : "0px", "height" : "0px", "top" : ((($(window).height()-32)/2)-50)}, 500, function() {
                $(this).remove();
            });
        }
    });
});