
<html>
	<!-- Global stylesheets -->
	<link href="https://fonts.googleapis.com/css?family=Noto+Sans+SC" rel="stylesheet" type="text/css">
	<link href="../assets/css/icons/icomoon/styles.min.css" rel="stylesheet" type="text/css">
	<link href="../assets/css/all.min.css" rel="stylesheet" type="text/css">
    <link href="../assets/css/custom.css" rel="stylesheet" type="text/css">
	<!-- /global stylesheets -->

	<!-- Core JS files -->
	<script src="../assets/js/main/jquery.min.js"></script>
	<script src="../assets/js/main/bootstrap.bundle.min.js"></script>
	<!-- /core JS files -->

	<!-- Theme JS files -->
	<script src="../assets/js/app.js"></script>
    <script src="../assets/js/plugins/tables/datatables/datatables.min.js"></script>
    <script src="../assets/js/demo_pages/datatables_basic.js"></script>
    <script src="../assets/js/demo_pages/components_modals.js"></script>
	<!-- /theme JS files -->

	<!-- Eschool鍘熸湰鐨刯s/css -->
	<link rel='stylesheet' href='../css/design_common.css?v=1764661859' type='text/css'>	<script src="../js/eschool-common.js"></script>
	<script src="../js/jquery.cookie.js"></script>
	<script src="../js/datepicker.min.js"></script>
	<link rel="stylesheet" href="../js/css/datepicker.min.css" type="text/css"><head>
<meta http-equiv="content-type" content="text/html; charset=gb2312">
<style>
#idcard {
	background-color:white;
	color:white;
	height:1px;
	border:0;
	outline:none;
	cursor:transparent;
}

#submit1 {
	background-color:skyblue;
	border:0;
	outline:none;
	color:skyblue;
}

div.pw {
	padding:0 0 0 70%;
}
</style>
<title>宽柔中学余额查询</title>
</head>
<script language="javascript">
function focus1(){
	document.getElementById("idcard").focus();
}
</script>
<body>
<!-- Main navbar - Used for Mobile-->
    
	   <div class="navbar navbar-expand-xl navbar-light navbar-static px-0 mobile">
		<div class="d-flex flex-1 pl-3">
			<button type="button" class="navbar-toggler sidebar-mobile-main-toggle ml-2">
				<i class="icon-transmission"></i>
			</button>
            
            <div class="navbar-brand wmin-0 mr-1">
				<a href="index.php" class="d-inline-block">
					<!-- <img src="global_assets/images/logo2.png" class="d-none d-sm-block" alt=""> -->
					<img src="../images/schlogo/foonyew.jpg" class="d-none d-sm-block" alt="">
					<img src="../images/schlogo/foonyew.jpg" class="d-sm-none" alt="">
				</a>
			</div>

			

			
		</div>



		<div class="d-flex flex-xl-1 justify-content-xl-end order-0 order-xl-1 pr-3">
			<ul class="navbar-nav navbar-nav-underline flex-row">
				
		
				<li class="nav-item nav-item-dropdown-xl dropdown dropdown-user h-100">
					<a href="#" class="navbar-nav-link navbar-nav-link-toggler d-flex align-items-center h-100 dropdown-toggle" data-toggle="dropdown">
						
						<span class="d-none d-xl-block"><i class="icon-cog"></i></span>
					</a>
		
					<div class="dropdown-menu dropdown-menu-right">
						
						<a href="#" class="dropdown-item">????</a>
                        <div class="dropdown-divider"></div>
                        <a href="#" class="dropdown-item">????</a>
						
					
					</div>
				</li>
			</ul>
		</div>
	</div>    
	<!-- /main navbar -->

	<!-- Page content -->
    
	<div class="page-content">

		<!-- Main sidebar -->
        
                
		<!-- /main sidebar -->
        

		<!-- Main content -->
		<div class="content-wrapper">

			<!-- Inner content -->
			<div class="content-inner">

				<!-- Page header -->
				<div class="page-header">
					<div class="page-header-content container d-sm-flex">
						<div class="page-title">
							<h4><strong><i class="icon-magazine"></i> <span class='translate'>余额查询</span></strong></h4>
						</div>
					</div>
				</div>
			<!-- /page header -->
				<!-- Content area -->
				<div class="content container pt-0">

			<!-- Horizontal form -->
				<form name="frmpos" method="post">
					<div class="card">
						<div class="card-body">
							<div class="row">
								<div class="col-lg-6">
									<div class="form-group row">
										<label class="col-lg-3 col-form-label">姓名</label>
										<div class="col-lg-9">
											<input type='text' readonly class='form-control form-control-sm' value=''>
												
										</div>
									</div>
						
									<div class="form-group row">
										<label class="col-lg-3 col-form-label">编号/学号</label>
										<div class="col-lg-9">
											<input type='text' readonly class='form-control form-control-sm' value=''>
												
										</div>
									</div>
									
									<div class="form-group row">
										<label class="col-lg-3 col-form-label">部门/班级</label>
										<div class="col-lg-9">
											<input type='text' readonly class='form-control form-control-sm' value=''>
												
										</div>
									</div>
									
									<!-- <div class="form-group row">
										<label class="col-lg-3 col-form-label">余额</label>
										<div class="col-lg-9">
											<input type='text' readonly class='form-control form-control-sm' value=''>
										</div>
									</div> -->
								</div>

								<div class="col-lg-2">
																</div>

								<div class="col-lg-4 bold" style="color: blue;">
									<label class="col-lg-12" style="font-size: 18pt;">余额 RM</label>
									<label class="col-lg-12 center" style="font-size: 32pt;">
																		</label>
								</div>
							</div>
					</div>
				</div>

						<input type="hidden" id="status1" name="status" value="1">
						<input type="hidden" id="cc1" name="cc" value="">
						<input type="hidden" id="hist_idcard1" name="hist_idcard" value="">
						
								<div class="form-group row">		
									<div class="col-lg-12">
																		
										<div class="card">
											<div class="card-body">
																				
												<div class="text-center">						
													<font size='5' color='blue'><span class='translate'>请刷卡</span></font>												</div>
											</div>
										</div>
									</div>
								</div>

																<h4>最后3笔交易记录</h4>
								<table class="table table-bordered table-striped">
									<thead>
										<tr>
											<th><span class='translate'>日期</span></th>
											<th><span class='translate'>商店</span></th>
											<th><span class='translate'>描述</span></th>
											<th><span class='translate'>数量</span></th>
											<th><span class='translate'>单价（RM）</span></th>
											<th><span class='translate'>总额（RM）</span></th>
										</tr>
									</thead>
									<tbody>
																			</tbody>
								</table>
								
												<div class="pw">
													<input type='password' id='idcard' name='idcard' size='1' autocomplete="off" style='font-size:1pt' onkeydown="cid()">
													<input type="password" style="display:none">												</div>

					</form>
				</div>
			</div>
		</div>
	</div>
	<script src="js/base64.js"></script>
	<script type="text/javascript">
	
	//每秒自动focus表单
	var timingfocus = window.setInterval(focusnow,1000);	
	function focusnow() {
		var idform = document.getElementById("idcard");
		var x = idform.disabled;
		if(x === false) {
			idform.focus();
		}
	}
	
	function cancel() {
		document.getElementById('status1').value='';
		document.frmpos.submit();
	}
	function bill() {
		window.location='pos2.php';
	}
	function bp() {
		window.open('pos3.php', 'newwindow', 'width=1, height=1');
		window.location='pos1.php';
	}
//action
	function rsform() {
		document.getElementById('action1').value="1";
		document.getElementById('update1').click();
	}
	function delrec(a) {
		var b = a+1;
		document.getElementById('result').deleteRow(b);
		document.getElementById('action1').value="2";
		document.getElementById('ac_row1').value=a;
		document.getElementById('update1').click();
	}
	function chgadd(a) {
		document.getElementById('action1').value="3";
		document.getElementById('ac_row1').value=a;
		document.getElementById('update1').click();
	}
	function chgsub(a) {
		document.getElementById('action1').value="4";
		document.getElementById('ac_row1').value=a;
		document.getElementById('update1').click();
	}
//

	//前台加密学生证
	function cid()
	{
		var key = event.which || event.keyCode;
		if (key == 13)
		{
			var pw = document.getElementById('idcard').value;
			var npw = base64.encode(pw);
			document.getElementById('idcard').value=npw;
			document.frmpos.submit();
		}
	}
	</script>
	</body>
</html>
