using System.Diagnostics;
using System.Net.Sockets;
using System.Windows.Forms;

var exeDirectory = AppContext.BaseDirectory;
var projectRoot = Path.GetFullPath(Path.Combine(exeDirectory, ".."));
var scriptPath = Path.Combine(exeDirectory, "启动维护工具.cmd");
var url = "http://127.0.0.1:4322";

if (!File.Exists(scriptPath))
{
    MessageBox.Show($"未找到启动脚本：{scriptPath}", "古典导聆维护工具", MessageBoxButtons.OK, MessageBoxIcon.Error);
    return;
}

try
{
    Process.Start(new ProcessStartInfo
    {
        FileName = "cmd.exe",
        Arguments = $"/k \"{scriptPath}\"",
        WorkingDirectory = projectRoot,
        UseShellExecute = true,
        WindowStyle = ProcessWindowStyle.Normal,
    });

    var deadline = DateTime.UtcNow.AddSeconds(90);
    while (DateTime.UtcNow < deadline)
    {
        try
        {
            using var client = new TcpClient();
            await client.ConnectAsync("127.0.0.1", 4322);
            Process.Start(new ProcessStartInfo
            {
                FileName = url,
                UseShellExecute = true,
            });
            return;
        }
        catch
        {
            await Task.Delay(1000);
        }
    }

    MessageBox.Show("维护工具正在启动，但浏览器未能在预期时间内自动打开。你仍可手动访问 http://127.0.0.1:4322 。", "古典导聆维护工具", MessageBoxButtons.OK, MessageBoxIcon.Information);
}
catch (Exception ex)
{
    MessageBox.Show($"启动失败：{ex.Message}", "古典导聆维护工具", MessageBoxButtons.OK, MessageBoxIcon.Error);
}
