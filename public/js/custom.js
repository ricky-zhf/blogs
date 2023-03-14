/* 站点运行时间 */
function runtime() {
	window.setTimeout("runtime()", 1000);
	/* 请修改这里的起始时间 */
    let startTime = new Date('01/03/2023 17:00:00');
    let endTime = new Date();
    let usedTime = endTime - startTime;
    let days = Math.floor(usedTime / (24 * 3600 * 1000));
    let leavel = usedTime % (24 * 3600 * 1000);
    let hours = Math.floor(leavel / (3600 * 1000));
    let leavel2 = leavel % (3600 * 1000);
    let minutes = Math.floor(leavel2 / (60 * 1000));
    let leavel3 = leavel2 % (60 * 1000);
    let seconds = Math.floor(leavel3 / (1000));
    let runbox = document.getElementById('run-time');
    runbox.innerHTML = '本站已运行<i class="far fa-clock fa-fw"></i> '
        + ((days < 10) ? '0' : '') + days + ' 天 '
        + ((hours < 10) ? '0' : '') + hours + ' 时 '
        + ((minutes < 10) ? '0' : '') + minutes + ' 分 '
        + ((seconds < 10) ? '0' : '') + seconds + ' 秒 ';
}
runtime();


function toc(parent, prefex) {
    parent.children("ul").each(function () {
      $ul = $(this);
      $ul.children("li").each(function () {
        $li = $(this);
        listStr = prefex
        if ($li.children("a").length > 0) {
          if (listStr != "") { 
            listStr += "."
          }
          listStr += ($li.index() + 1);
          $li.html(listStr + " " + $li.html());
          toc($li, listStr)
        } else {
          toc($li, listStr)
        }
      });
    });
  }

var $t = $("#TableOfContents");
toc($t, "");

/* 后置加载页面组件的背景图片 */
$(function() {
	/* 首页头像div加载GitHub Chart作为背景图片 */
	$("div.home-avatar").attr('style', "background: url(https://ghchart.rshah.org/FFA500/ricky-zhf);background-repeat: no-repeat;background-position: center;background-size: auto 7.5rem;");

	/* 评论框加载背景图片 */
	// $(".v[data-class=v] .veditor").attr('style', "background-image: url(" + $cdnPrefix + "/images/common/valinebg.webp) !important;");
});