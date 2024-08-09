const strip = require('./strip')
const fs = require('hexo-fs')
const fm = require('hexo-front-matter')
const { createClient } = require('@supabase/supabase-js')
const SHA256 = require("crypto-js/sha256");
const ChucklePostAI =  require('./plugin')
const config = hexo.config.aiexcerpt
const supabase = createClient(config.appUrl, config.appKey)

hexo.extend.filter.register('after_post_render', async function (data) {
    const content = strip(data.content, config.ignoreEl);
    var hash = SHA256(content).toString();
            str =  "<script src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js'></script>"
            str +=  "<script src='https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js'></script>"
      const contentToInject = `<script src="https://cdn.jsdelivr.net/npm/gitbook-plugin-ai-summary@1.0.3/assets/plugin.js"></script><script>
       new ChucklePostAI({
        el: '.post-body',
        summary_directly: true,
        summary_toggle: false,
        rec_method: 'web',
        pjax: true,
        token: '${hash}',
        summary_url: '${config.summary_url}'
    })
</script>`;
    data.content += str + contentToInject;

    if (config.default_enable) data.aiexcerpt = data.aiexcerpt || true
    if (!data.aiexcerpt || data.excerpt || data.description) return data
    if (content.length > config.max_token) {
        return data
    }
    const path = this.source_dir + data.source
    const frontMatter = fm.parse(await fs.readFile(path));

    const { data: data1, error } = await supabase
        .from('summary')
        .upsert({ hash: hash })
        .select()

    if (error) {
        console.log(error)
        return data;
    }

    if (data1[0].summary) {
        frontMatter.excerpt = data.excerpt = data1[0].summary;
        await fs.writeFile(path, `---\n${fm.stringify(frontMatter)}`);
        return data;
    }

    let response = '';
    try {
        response = await fetch(config.summary_url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                "content": content,
                "token": hash
            }),
            redirect: "follow"
        });

        if (!response.ok) {
            console.log(response)
            throw new Error('Response not ok');
        }
    } catch (error) {
        console.log(error)
        return data;
    }
    const res = await response.json();
    frontMatter.excerpt = data.excerpt = res.summary;

    return data
});
